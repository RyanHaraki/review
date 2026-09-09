import { z } from "zod";
import type {
  DraftReference,
  LineAnchor,
  PullRequestDraft,
  PullRequestDiff,
  PullRequestKey,
} from "@review/contracts";
import { pullRequestDraftSchema } from "@review/contracts";
import {
  GitHubRejection,
  prPath,
  readPages,
  readRemoteDetail,
  readRemoteDiff,
  readRemoteThreads,
  type GitHubRequest,
} from "./pull-request-github.js";

// HTTP payloads are parsed by each caller and by the local server boundary.
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns */
export type LocalRequest = (
  path: string,
  body: unknown,
  method?: "POST" | "PUT",
) => Promise<unknown>;
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns */
export function validateAnchor(
  anchor: LineAnchor,
  diff: PullRequestDiff,
): void {
  if (anchor.headSha !== diff.headSha || anchor.baseSha !== diff.baseSha)
    throw new Error("The pull request changed. Select the lines again.");
  const file = diff.files.find((item) => item.path === anchor.path);
  if (!file?.patch)
    throw new Error("These lines are not available for a comment.");
  let oldLine = 0;
  let newLine = 0;
  let hunk = 0;
  const lines = new Map<number, number>();
  for (const row of file.patch.split("\n")) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      hunk += 1;
      continue;
    }
    if (!hunk || row.startsWith("\\")) continue;
    if (row.startsWith(" ")) {
      lines.set(anchor.side === "LEFT" ? oldLine : newLine, hunk);
      oldLine += 1;
      newLine += 1;
    } else if (row.startsWith("-")) {
      if (anchor.side === "LEFT") lines.set(oldLine, hunk);
      oldLine += 1;
    } else if (row.startsWith("+")) {
      if (anchor.side === "RIGHT") lines.set(newLine, hunk);
      newLine += 1;
    }
  }
  const selectedHunk = lines.get(anchor.startLine);
  if (!selectedHunk || anchor.line - anchor.startLine > lines.size)
    throw new Error("Select lines within one diff section.");
  for (let line = anchor.startLine; line <= anchor.line; line += 1) {
    if (lines.get(line) !== selectedHunk)
      throw new Error("Select lines within one diff section.");
  }
}
const receiptSchema = z.object({ html_url: z.string().url() });
const remoteComment = receiptSchema.extend({
  body: z.string(),
});
function marker(id: string) {
  return `<!-- review-draft:${id} -->`;
}
async function finish(
  local: LocalRequest,
  draft: PullRequestDraft,
  status: "draft" | "submitted" | "uncertain",
  error: string | null,
  remoteUrl: string | null,
) {
  return pullRequestDraftSchema.parse(
    await local("drafts/finish", {
      key: draft.key,
      id: draft.id,
      revision: draft.revision,
      status,
      error,
      remoteUrl,
    }),
  );
}
async function reconcile(
  draft: PullRequestDraft,
  github: GitHubRequest,
  local: LocalRequest,
) {
  const detail = await readRemoteDetail(draft.key, github);
  if (draft.target.kind === "description") {
    if (detail.repository.pullRequest.body === draft.body)
      return finish(
        local,
        draft,
        "submitted",
        null,
        detail.repository.pullRequest.url,
      );
  } else {
    const path =
      draft.target.kind === "discussion"
        ? `repos/${draft.key.repository}/issues/${draft.key.number}/comments`
        : `${prPath(draft.key)}/comments`;
    const comments = await readPages(path, remoteComment, github);
    const found = comments.filter(
      (comment) => comment.body === `${draft.body}\n${marker(draft.id)}`,
    );
    if (found.length === 1 && found[0])
      return finish(local, draft, "submitted", null, found[0].html_url);
  }
  return draft;
}
type LineCommentPayload = {
  body: string;
  commit_id: string;
  path: string;
  side: string;
  line: number;
  start_line?: number;
  start_side?: string;
};
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function submissionError(error: unknown) {
  return error instanceof Error ? error.message : "Could not submit the draft.";
}
function lineCommentPayload(anchor: LineAnchor, body: string) {
  const payload: LineCommentPayload = {
    body,
    commit_id: anchor.headSha,
    path: anchor.path,
    side: anchor.side,
    line: anchor.line,
  };
  if (anchor.startLine < anchor.line) {
    payload.start_line = anchor.startLine;
    payload.start_side = anchor.side;
  }
  return payload;
}
const activeSubmissions = new Map<string, Promise<PullRequestDraft>>();
export function submitDraft(
  reference: DraftReference,
  github: GitHubRequest,
  local: LocalRequest,
): Promise<PullRequestDraft> {
  const active = activeSubmissions.get(reference.id);
  if (active) return active;
  const submission = performSubmission(reference, github, local).finally(() => {
    activeSubmissions.delete(reference.id);
  });
  activeSubmissions.set(reference.id, submission);
  return submission;
}
async function recoverSubmission(
  draft: PullRequestDraft,
  github: GitHubRequest,
  local: LocalRequest,
) {
  const uncertain =
    draft.status === "submitting"
      ? await finish(
          local,
          draft,
          "uncertain",
          "The previous submission has no receipt. Checking GitHub before any retry.",
          null,
        )
      : draft;
  return reconcile(uncertain, github, local);
}
async function performSubmission(
  reference: DraftReference,
  github: GitHubRequest,
  local: LocalRequest,
): Promise<PullRequestDraft> {
  const drafts = z
    .array(pullRequestDraftSchema)
    .parse(await local("drafts/read", reference.key));
  const current = drafts.find((draft) => draft.id === reference.id);
  if (current?.revision !== reference.revision)
    throw new Error("The draft changed. Reload it before submitting.");
  if (current.status === "submitted") return current;
  if (current.status !== "draft")
    return recoverSubmission(current, github, local);
  const draft = pullRequestDraftSchema.parse(
    await local("drafts/claim", reference),
  );
  if (draft.status === "submitted") return draft;
  let dispatched = false;
  try {
    if (draft.target.kind !== "description" && !draft.body.trim())
      throw new Error("Enter a comment before submitting.");
    const detail = (await readRemoteDetail(draft.key, github)).repository
      .pullRequest;
    const body = `${draft.body}\n${marker(draft.id)}`;
    let response: unknown;
    switch (draft.target.kind) {
      case "description":
        if (!detail.viewerCanUpdate)
          throw new Error("You cannot edit this pull request description.");
        if (detail.body !== draft.target.originalBody)
          throw new Error(
            "The description changed on GitHub. Review it before submitting.",
          );
        dispatched = true;
        response = await github(
          prPath(draft.key),
          { body: draft.body },
          "PATCH",
        );
        break;
      case "discussion":
        dispatched = true;
        response = await github(
          `repos/${draft.key.repository}/issues/${draft.key.number}/comments`,
          { body },
        );
        break;
      case "line": {
        const anchor = draft.target.anchor;
        validateAnchor(anchor, await readRemoteDiff(draft.key, github));
        dispatched = true;
        response = await github(
          `${prPath(draft.key)}/comments`,
          lineCommentPayload(anchor, body),
        );
        break;
      }
      case "reply": {
        const target = draft.target;
        const thread = (await readRemoteThreads(draft.key, github)).find(
          (item) => item.id === target.threadId,
        );
        if (
          !thread?.comments.some(
            (comment) => comment.databaseId === target.commentId,
          )
        )
          throw new Error(
            "The comment does not belong to this pull request thread.",
          );
        const root = thread.comments[0];
        if (!root) throw new Error("The thread has no comment to reply to.");
        dispatched = true;
        response = await github(
          `${prPath(draft.key)}/comments/${root.databaseId}/replies`,
          { body },
        );
        break;
      }
    }
    const receipt = receiptSchema.parse(response);
    return await finish(local, draft, "submitted", null, receipt.html_url);
  } catch (error) {
    const message = submissionError(error);
    return finish(
      local,
      draft,
      dispatched && !(error instanceof GitHubRejection) ? "uncertain" : "draft",
      message,
      null,
    );
  }
}
export async function resolveThread(
  key: PullRequestKey,
  threadId: string,
  resolved: boolean,
  github: GitHubRequest,
): Promise<void> {
  const thread = (await readRemoteThreads(key, github)).find(
    (item) => item.id === threadId,
  );
  if (!thread)
    throw new Error("The thread does not belong to this pull request.");
  if (thread.isResolved === resolved) return;
  if (!(resolved ? thread.canResolve : thread.canUnresolve))
    throw new Error("You cannot change this thread's resolution.");
  const operation = resolved ? "resolveReviewThread" : "unresolveReviewThread";
  const result = await github("graphql", {
    query: `mutation($id:ID!){ result:${operation}(input:{threadId:$id}){thread{id isResolved}} }`,
    variables: { id: threadId },
  });
  const returned = z
    .object({
      data: z.object({
        result: z.object({
          thread: z.object({ id: z.string(), isResolved: z.boolean() }),
        }),
      }),
    })
    .parse(result).data.result.thread;
  if (returned.id !== threadId || returned.isResolved !== resolved)
    throw new Error("GitHub did not confirm the thread update.");
}
