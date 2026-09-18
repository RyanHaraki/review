#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

const args = process.argv.slice(2);
const statePath = args[args.indexOf("--state") + 1];
if (!args.includes("--state") || !statePath || !isAbsolute(statePath)) {
  throw new Error("Usage: node github-review-server.mjs --state <new-absolute-state-path>");
}
const repository = "review-fixture/demo";
const number = 42;
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const date = "2026-09-07T12:00:00Z";
const url = `https://github.com/${repository}/pull/${number}`;
const actor = { login: "fixture-reviewer", avatarUrl: null };
const pageInfo = { hasNextPage: false, endCursor: null };
function graphComment(id, body) { return { id: `COMMENT_${id}`, databaseId: id, author: actor, body, createdAt: date, url: `${url}#discussion_r${id}` }; }
function initialState() {
  return {
    repository, number, auth: { accountId: 42, login: "fixture-reviewer", outcome: "approved", revoked: false }, devices: {}, requests: [], body: "## Review fixture\n\nTest the complete review workflow.\n\n- [x] Durable local drafts\n- [ ] Publish a comment\n\n| File | Purpose |\n| --- | --- |\n| greeting.ts | Greeting function |\n\n```ts\nconst greeting = greet(\"Ada\");\n```", baseSha, headSha,
    nextId: 200, mutations: [], discussions: [],
    threads: [{ id: "THREAD_100", path: "src/greeting.ts", line: 5, startLine: null, diffSide: "RIGHT", isResolved: false, isOutdated: false, viewerCanResolve: true, viewerCanUnresolve: true, comments: { nodes: [graphComment(100, "Can we keep the greeting easy to test?"), graphComment(101, "Yes, the function has no external dependencies.")], pageInfo } }],
  };
}

function save(state) {
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2));
  renameSync(temporary, statePath);
}
if (existsSync(statePath)) throw new Error("State already exists. Use a new isolated state path.");
mkdirSync(dirname(statePath), { recursive: true });
save(initialState());
function pullRequest(state) {
  return { number, title: "Add greeting and review examples", author: { login: state.auth.login, avatarUrl: "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%271%27%20height=%271%27%3E%3C/svg%3E" }, updatedAt: date, additions: 4006, deletions: 1, changedFiles: 4, isDraft: false, url, headRefName: "feature/greetings", baseRefName: "main", headRefOid: state.headSha, baseRefOid: state.baseSha, fullDatabaseId: "424242", reviewDecision: null, state: "OPEN" };
}
async function handle(request, response) {
  const endpoint = request.url.replace(/^\//, "");
  const method = request.method;
  let input = "";
  for await (const chunk of request) {
    input += chunk;
    if (input.length > 1000000) throw new Error("Request too large");
  }
  const body = input ? (request.headers["content-type"]?.includes("json") ? JSON.parse(input) : Object.fromEntries(new URLSearchParams(input))) : {};
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const json = (value, status = 200) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };
  const fail = message => { json({ message: `Fixture rejected request: ${message}` }, 422); throw new Error(message); };
  state.requests.push({ method, path: endpoint.split("?")[0] });
  save(state);
  if (endpoint === "login/device/code" && method === "POST") {
    if (body.client_id !== "review-fixture-client") return json({ error: "incorrect_client_credentials" }, 400);
    const deviceCode = `fixture-device-${Object.keys(state.devices).length + 1}`;
    state.devices[deviceCode] = { accountId: state.auth.accountId, login: state.auth.login };
    save(state);
    return json({ device_code: deviceCode, user_code: "TEST-CODE", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 1 });
  }
  if (endpoint === "login/oauth/access_token" && method === "POST") {
    if (body.client_id !== "review-fixture-client") return json({ error: "incorrect_client_credentials" });
    const device = state.devices[body.device_code];
    if (!device) return json({ error: "expired_token" });
    if (state.auth.outcome !== "approved") return json({ error: state.auth.outcome });
    return json({ access_token: `fixture-token-${device.accountId}`, token_type: "bearer", scope: "" });
  }
  const authorization = request.headers.authorization;
  const accountId = state.auth.accountId;
  if (state.auth.revoked || authorization !== `Bearer fixture-token-${accountId}`) return json({ message: "Bad credentials" }, 401);
  if (endpoint === "user" && method === "GET") return json({ id: accountId, login: state.auth.login, avatar_url: null });
  const pathWithoutQuery = endpoint.split("?")[0];
  if (pathWithoutQuery === "user/installations" && method === "GET") return json({ total_count: 1, installations: [{ id: 7, account: { id: accountId, login: state.auth.login } }] });
  if (pathWithoutQuery === "user/installations/7/repositories" && method === "GET") return json({ total_count: 1, repositories: [{ id: 99, full_name: repository, private: false, archived: false, permissions: { pull: true, push: true } }] });
  function record(kind, payload) { state.mutations.push({ kind, payload, at: new Date().toISOString() }); save(state); }
  if (endpoint === "graphql") {
    const query = body.query ?? "";
    if (query.trimStart().startsWith("mutation")) {
      const id = body.variables?.id;
      const thread = state.threads.find((item) => item.id === id);
      if (!thread || !query.includes("resolveReviewThread")) fail("unknown GraphQL mutation");
      thread.isResolved = !query.includes("unresolveReviewThread");
      record(thread.isResolved ? "resolve" : "unresolve", { threadId: id });
      json({ data: { result: { thread: { id, isResolved: thread.isResolved } } } });
    } else if (query.includes("pullRequests(")) {
      json({ data: { repository: { pullRequests: { nodes: [pullRequest(state)], pageInfo } } } });
    } else if (query.includes("reviewThreads")) {
      json({ data: { repository: { pullRequest: { reviewThreads: { nodes: state.threads, pageInfo } } } } });
    } else if (query.includes("node(id:")) {
      const thread = state.threads.find((item) => item.id === body.variables?.id);
      if (!thread) fail("unknown thread");
      json({ data: { node: { comments: thread.comments } } });
    } else if (query.includes("pullRequest(number:")) {
      json({ data: { viewer: { login: actor.login }, repository: { pullRequest: { body: state.body, updatedAt: date, baseRefOid: state.baseSha, headRefOid: state.headSha, viewerCanUpdate: true, url } } } });
    } else fail("unknown GraphQL read");
    return;
  }
  const path = endpoint.split("?")[0];
  const pr = `repos/${repository}/pulls/${number}`;
  const issue = `repos/${repository}/issues/${number}`;
  if (method === "GET") {
    if (new URL(`https://fixture.invalid/${endpoint}`).searchParams.has("page") && new URL(`https://fixture.invalid/${endpoint}`).searchParams.get("page") !== "1") { json([]); return; }
    if (path === pr) {
      json({ title: "Review fixture", body: state.body, changed_files: 4, base: { sha: state.baseSha }, head: { sha: state.headSha } });
    } else if (path === `${pr}/files`) {
      const changed = Array.from({ length: 30 }, (_, index) => {
        const line = index + 1;
        if (line === 1) return ' export function greet(name: string) {';
        if (line === 2) return '-  return "Hello " + name;\n+  const safeName = name.trim();';
        if (line === 3) return '+  return `Hello, ${safeName}!`;';
        if (line === 4) return ' }';
        return ` // Example context line ${line}`;
      }).join("\n");
      json([{ filename: "src/greeting.ts", status: "modified", additions: 2, deletions: 1, patch: `@@ -1,29 +1,30 @@\n${changed}` }, { filename: "src/example.ts", status: "added", additions: 4, deletions: 0, patch: '@@ -0,0 +1,4 @@\n+import { greet } from "./greeting";\n+\n+export const example = greet("Ada");\n+export const ready = true;' }, { filename: "assets/icon.png", status: "added", additions: 0, deletions: 0 }, { filename: "src/large.ts", status: "added", additions: 4000, deletions: 0, patch: "@@ -0,0 +1,4000 @@\n" + Array.from({ length: 4000 }, (_, index) => `+export const value${index + 1} = ${index + 1};`).join("\n") }]);
    } else if (path === `${issue}/timeline`) {
      json([{ id: 1, event: "committed", sha: headSha, message: "Add greeting examples", author: { name: actor.login, date }, html_url: url }, { id: 2, event: "reviewed", body: "The structure looks good.", state: "commented", submitted_at: date, user: { login: actor.login, avatar_url: null }, html_url: url }, ...state.discussions.map((comment) => ({ ...comment, event: "commented", created_at: date }))]);
    } else if (path === `${issue}/comments`) json(state.discussions);
    else if (path === `${pr}/comments`) json(state.threads.flatMap((thread) => thread.comments.nodes.map((comment) => ({ id: comment.databaseId, body: comment.body, user: { login: comment.author.login }, html_url: comment.url }))));
    else fail(`unknown GET ${path}`);
    return;
  }
  if (path === pr && method === "PATCH") {
    if (typeof body.body !== "string") fail("description body required");
    state.body = body.body; record("description", body); json({ html_url: url });
  } else if (method === "POST" && path === `${issue}/comments`) {
    if (!body.body?.trim()) fail("comment body required");
    const id = state.nextId++;
    const comment = { id, body: body.body, user: { login: actor.login, avatar_url: null }, html_url: `${url}#issuecomment-${id}` };
    state.discussions.push(comment); record("discussion", body); json(comment);
  } else if (method === "POST" && path === `${pr}/comments`) {
    if (body.commit_id !== state.headSha || !body.body?.trim() || !["src/greeting.ts", "src/example.ts", "src/large.ts"].includes(body.path) || !["LEFT", "RIGHT"].includes(body.side) || !Number.isInteger(body.line)) fail("invalid inline comment anchor");
    const id = state.nextId++;
    const comment = graphComment(id, body.body);
    state.threads.push({ id: `THREAD_${id}`, path: body.path, line: body.line, startLine: body.start_line ?? null, diffSide: body.side, isResolved: false, isOutdated: false, viewerCanResolve: true, viewerCanUnresolve: true, comments: { nodes: [comment], pageInfo } });
    record("line", body); json({ id, html_url: comment.url });
  } else if (method === "POST" && path?.startsWith(`${pr}/comments/`) && path.endsWith("/replies")) {
    const id = Number(path.split("/").at(-2));
    const thread = state.threads.find((item) => item.comments.nodes[0].databaseId === id);
    if (!thread || !body.body?.trim()) fail("reply requires a root comment and body");
    const comment = graphComment(state.nextId++, body.body); thread.comments.nodes.push(comment);
    record("reply", { ...body, rootCommentId: id }); json({ id: comment.databaseId, html_url: comment.url });
  } else fail(`unknown mutation ${method} ${path}`);
}
const server = createServer((request, response) => {
  void handle(request, response).catch(error => {
    if (!response.headersSent) { response.writeHead(500, { "content-type": "application/json" }); response.end(JSON.stringify({ message: error.message })); }
  });
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(`${JSON.stringify({ origin: `http://127.0.0.1:${address.port}`, statePath, repository, number, clientId: "review-fixture-client" })}\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
