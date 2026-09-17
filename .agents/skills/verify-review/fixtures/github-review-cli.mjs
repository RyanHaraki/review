#!/usr/bin/env node
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

const statePath = process.env.REVIEW_GITHUB_FIXTURE_STATE;
if (!statePath || !isAbsolute(statePath)) {
  process.stderr.write("Fixture requires an absolute REVIEW_GITHUB_FIXTURE_STATE path. No GitHub calls are made.\n");
  process.exit(2);
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
    repository, number, body: "## Review fixture\n\nTest the complete review workflow.\n\n- [x] Durable local drafts\n- [ ] Publish a comment\n\n| File | Purpose |\n| --- | --- |\n| greeting.ts | Greeting function |\n\n```ts\nconst greeting = greet(\"Ada\");\n```", baseSha, headSha,
    nextId: 200, mutations: [], discussions: [],
    threads: [{ id: "THREAD_100", path: "src/greeting.ts", line: 5, startLine: null, diffSide: "RIGHT", isResolved: false, isOutdated: false, viewerCanResolve: true, viewerCanUnresolve: true, comments: { nodes: [graphComment(100, "Can we keep the greeting easy to test?"), graphComment(101, "Yes, the function has no external dependencies.")], pageInfo } }],
  };
}
function save(state) { const temporary = `${statePath}.${process.pid}.tmp`; writeFileSync(temporary, JSON.stringify(state, null, 2)); renameSync(temporary, statePath); }
function json(value) { writeFileSync(1, `${JSON.stringify(value)}\n`); }
function fail(message) { process.stderr.write(`gh: fixture rejected request: ${message} (HTTP 422)\n`); process.exit(1); }
const args = process.argv.slice(2);
if (args[0] === "--init") {
  if (existsSync(statePath)) fail("state already exists; use a new isolated state path");
  mkdirSync(dirname(statePath), { recursive: true }); save(initialState()); json({ statePath, repository, number }); process.exit(0);
}
if (!existsSync(statePath)) fail("initialize the fixture with --init first");
const state = JSON.parse(readFileSync(statePath, "utf8"));
if (args[0] === "--version") { process.stdout.write("gh version review-verification-fixture\n"); process.exit(0); }
if (args[0] === "auth" && args[1] === "status") { process.stdout.write("Fixture account connected\n"); process.exit(0); }
if (args[0] === "pr" && args[1] === "list") {
  if (args[args.indexOf("--repo") + 1] !== repository) fail("unknown repository");
  json([{ number, title: "Add greeting and review examples", author: { login: actor.login }, updatedAt: date, additions: 4006, deletions: 1, changedFiles: 4, isDraft: false, url, headRefName: "feature/greetings", baseRefName: "main", headRefOid: state.headSha, baseRefOid: state.baseSha, fullDatabaseId: "424242", reviewDecision: "", state: "OPEN" }]);
  process.exit(0);
}
if (args[0] !== "api") fail(`unknown CLI command ${args.join(" ")}`);
let endpoint;
let method = "GET";
let input = false;
for (let index = 1; index < args.length; index += 1) {
  const item = args[index];
  if (["--method", "-X"].includes(item)) { method = args[++index]; continue; }
  if (item === "--input") { if (args[++index] !== "-") fail("only stdin input is supported"); input = true; continue; }
  if (["-f", "--field", "--jq", "--cache", "--header", "-H"].includes(item)) { index += 1; continue; }
  if (item.startsWith("-")) continue;
  if (endpoint) fail("multiple endpoints");
  endpoint = item.replace(/^\//, "");
}
const body = input ? JSON.parse(readFileSync(0, "utf8")) : {};
if (endpoint === "user" && method === "GET") { process.stdout.write(`${actor.login}\n`); process.exit(0); }
if (endpoint === "user/repos" && method === "GET") { process.stdout.write(`${repository}\tfalse\n`); process.exit(0); }
function record(kind, payload) { state.mutations.push({ kind, payload, at: new Date().toISOString() }); save(state); }
if (endpoint === "graphql") {
  const query = body.query ?? "";
  if (query.startsWith("mutation")) {
    const id = body.variables?.id;
    const thread = state.threads.find((item) => item.id === id);
    if (!thread || !query.includes("resolveReviewThread")) fail("unknown GraphQL mutation");
    thread.isResolved = !query.includes("unresolveReviewThread");
    record(thread.isResolved ? "resolve" : "unresolve", { threadId: id });
    json({ data: { result: { thread: { id, isResolved: thread.isResolved } } } });
  } else if (query.includes("reviewThreads")) {
    json({ data: { repository: { pullRequest: { reviewThreads: { nodes: state.threads, pageInfo } } } } });
  } else if (query.includes("node(id:")) {
    const thread = state.threads.find((item) => item.id === body.variables?.id);
    if (!thread) fail("unknown thread");
    json({ data: { node: { comments: thread.comments } } });
  } else if (query.includes("pullRequest(number:")) {
    json({ data: { viewer: { login: actor.login }, repository: { pullRequest: { body: state.body, updatedAt: date, baseRefOid: state.baseSha, headRefOid: state.headSha, viewerCanUpdate: true, url } } } });
  } else fail("unknown GraphQL read");
  process.exit(0);
}
const path = endpoint?.split("?")[0];
const pr = `repos/${repository}/pulls/${number}`;
const issue = `repos/${repository}/issues/${number}`;
if (method === "GET") {
  if (endpoint.includes("page=") && new URL(`https://fixture.invalid/${endpoint}`).searchParams.get("page") !== "1") { json([]); process.exit(0); }
  if (path === `${pr}/files`) {
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
  process.exit(0);
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
