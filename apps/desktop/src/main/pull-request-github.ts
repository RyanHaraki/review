import { execFile } from "node:child_process";
import { z } from "zod";
import type {
  PullRequestKey,
  PullRequestOverview,
  PullRequestDiff,
  PullRequestThread,
} from "@review/contracts";

// Raw subprocess JSON is parsed by endpoint-specific schemas below.
/* oxlint-disable anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type */
export type GitHubRequest = (
  endpoint: string,
  body?: Record<string, unknown>,
  method?: string,
) => Promise<unknown>;
/* oxlint-enable anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type */
export class GitHubRejection extends Error {}
export const requestGitHub: GitHubRequest = (endpoint, body, method) =>
  new Promise((resolve, reject) => {
    const args = [
      "api",
      endpoint,
      "--method",
      method ?? (body ? "POST" : "GET"),
    ];
    if (body) args.push("--input", "-");
    const child = execFile(
      "gh",
      args,
      { maxBuffer: 30_000_000 },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr.trim() || "GitHub request failed.";
          reject(
            /HTTP (400|401|403|404|405|409|422)\b/.test(message)
              ? new GitHubRejection(message)
              : new Error(message),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("GitHub returned invalid JSON."));
        }
      },
    );
    child.stdin?.end(body ? JSON.stringify(body) : undefined);
  });
const actor = z.object({ login: z.string(), avatarUrl: z.string().nullable() });
const pageInfo = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});
const graphComment = z.object({
  id: z.string(),
  databaseId: z.number(),
  author: actor.nullable(),
  body: z.string(),
  createdAt: z.string(),
  url: z.string(),
});
const commentsConnection = z.object({ nodes: z.array(graphComment), pageInfo });
const graphThread = z.object({
  id: z.string(),
  path: z.string(),
  line: z.number().nullable(),
  startLine: z.number().nullable(),
  diffSide: z.enum(["LEFT", "RIGHT"]),
  isResolved: z.boolean(),
  isOutdated: z.boolean(),
  viewerCanResolve: z.boolean(),
  viewerCanUnresolve: z.boolean(),
  comments: commentsConnection,
});
const detailSchema = z.object({
  body: z.string(),
  updatedAt: z.string(),
  baseRefOid: z.string(),
  headRefOid: z.string(),
  viewerCanUpdate: z.boolean(),
  url: z.string(),
});
const commentFields =
  "id databaseId author { login avatarUrl } body createdAt url";
const threadFields = `id path line startLine diffSide isResolved isOutdated viewerCanResolve viewerCanUnresolve comments(first:100) { nodes { ${commentFields} } pageInfo { hasNextPage endCursor } }`;
export function prPath(key: PullRequestKey) {
  return `repos/${key.repository}/pulls/${key.number}`;
}
export function stripDraftMarker(body: string) {
  return body.replace(/\n?<!-- review-draft:[0-9a-f-]+ -->/g, "");
}
export async function readRemoteDetail(
  key: PullRequestKey,
  request: GitHubRequest,
) {
  const [owner, name] = key.repository.split("/");
  const response = await request("graphql", {
    query:
      "query($owner:String!,$name:String!,$number:Int!){ viewer { login } repository(owner:$owner,name:$name){ pullRequest(number:$number){ body updatedAt baseRefOid headRefOid viewerCanUpdate url } } }",
    variables: { owner, name, number: key.number },
  });
  return z
    .object({
      data: z.object({
        viewer: z.object({ login: z.string() }),
        repository: z.object({ pullRequest: detailSchema }),
      }),
    })
    .parse(response).data;
}
export async function readRemoteThreads(
  key: PullRequestKey,
  request: GitHubRequest,
): Promise<PullRequestThread[]> {
  const [owner, name] = key.repository.split("/");
  const threads: PullRequestThread[] = [];
  let cursor: string | null = null;
  do {
    const response = await request("graphql", {
      query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes { ${threadFields} } pageInfo {hasNextPage endCursor}}}}}`,
      variables: { owner, name, number: key.number, cursor },
    });
    const connection = z
      .object({
        data: z.object({
          repository: z.object({
            pullRequest: z.object({
              reviewThreads: z.object({
                nodes: z.array(graphThread),
                pageInfo,
              }),
            }),
          }),
        }),
      })
      .parse(response).data.repository.pullRequest.reviewThreads;
    for (const thread of connection.nodes) {
      const comments = [...thread.comments.nodes];
      let commentPage = thread.comments.pageInfo;
      while (commentPage.hasNextPage) {
        if (!commentPage.endCursor)
          throw new Error("GitHub comment pagination is incomplete.");
        const next = await request("graphql", {
          query: `query($id:ID!,$cursor:String){node(id:$id){... on PullRequestReviewThread {comments(first:100,after:$cursor){nodes { ${commentFields} } pageInfo {hasNextPage endCursor}}}}}`,
          variables: { id: thread.id, cursor: commentPage.endCursor },
        });
        const result = z
          .object({
            data: z.object({
              node: z.object({ comments: commentsConnection }),
            }),
          })
          .parse(next).data.node.comments;
        comments.push(...result.nodes);
        commentPage = result.pageInfo;
      }
      threads.push({
        id: thread.id,
        path: thread.path,
        line: thread.line,
        startLine: thread.startLine,
        side: thread.diffSide,
        isResolved: thread.isResolved,
        isOutdated: thread.isOutdated,
        canResolve: thread.viewerCanResolve,
        canUnresolve: thread.viewerCanUnresolve,
        comments: comments.map((comment) => ({
          ...comment,
          body: stripDraftMarker(comment.body),
        })),
      });
    }
    if (connection.pageInfo.hasNextPage && !connection.pageInfo.endCursor)
      throw new Error("GitHub thread pagination is incomplete.");
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);
  return threads;
}
export async function readPages<T>(
  path: string,
  schema: z.ZodType<T>,
  request: GitHubRequest,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const batch = z
      .array(schema)
      .parse(await request(`${path}?per_page=100&page=${page}`));
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}
const restActor = z.object({
  login: z.string(),
  avatar_url: z.string().nullable(),
});
const timelineEntry = z.object({
  id: z.number().optional(),
  node_id: z.string().optional(),
  event: z.string(),
  actor: restActor.nullable().optional(),
  user: restActor.nullable().optional(),
  body: z.string().nullable().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  submitted_at: z.string().nullable().optional(),
  html_url: z.string().optional(),
  sha: z.string().optional(),
  message: z.string().optional(),
  author: z
    .object({ name: z.string().optional(), date: z.string().optional() })
    .nullable()
    .optional(),
});
export async function readRemoteOverview(
  key: PullRequestKey,
  request: GitHubRequest,
): Promise<PullRequestOverview> {
  const [detail, threads, events] = await Promise.all([
    readRemoteDetail(key, request),
    readRemoteThreads(key, request),
    readPages(
      `repos/${key.repository}/issues/${key.number}/timeline`,
      timelineEntry,
      request,
    ),
  ]);
  const pr = detail.repository.pullRequest;
  return {
    body: pr.body,
    updatedAt: pr.updatedAt,
    baseSha: pr.baseRefOid,
    headSha: pr.headRefOid,
    canEdit: pr.viewerCanUpdate,
    viewerLogin: detail.viewer.login,
    threads,
    activity: events
      .map((event, index) => {
        const user = event.actor ?? event.user;
        const kind: PullRequestOverview["activity"][number]["kind"] =
          event.event === "commented"
            ? "comment"
            : event.event === "reviewed"
              ? "review"
              : event.event === "committed"
                ? "commit"
                : "event";
        return {
          id:
            event.node_id ??
            String(event.id ?? event.sha ?? `${event.event}-${index}`),
          kind,
          author: user
            ? { login: user.login, avatarUrl: user.avatar_url }
            : null,
          body: stripDraftMarker(event.body ?? event.message ?? ""),
          summary:
            event.event === "reviewed"
              ? (event.state ?? "reviewed").replaceAll("_", " ")
              : event.event.replaceAll("_", " "),
          createdAt:
            event.created_at ?? event.submitted_at ?? event.author?.date ?? "",
          url: event.html_url ?? pr.url,
        };
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}
const restFile = z.object({
  filename: z.string(),
  previous_filename: z.string().optional(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
});
export async function readRemoteDiff(
  key: PullRequestKey,
  request: GitHubRequest,
): Promise<PullRequestDiff> {
  const before = (await readRemoteDetail(key, request)).repository.pullRequest;
  const files = await readPages(`${prPath(key)}/files`, restFile, request);
  if (files.length >= 3000)
    throw new Error(
      "GitHub limits this file list to 3,000 files. Open the complete diff on GitHub.",
    );
  const after = (await readRemoteDetail(key, request)).repository.pullRequest;
  if (
    before.baseRefOid !== after.baseRefOid ||
    before.headRefOid !== after.headRefOid
  )
    throw new Error("The pull request changed while loading. Reload the diff.");
  return {
    baseSha: before.baseRefOid,
    headSha: before.headRefOid,
    files: files.map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch ?? null,
    })),
  };
}
