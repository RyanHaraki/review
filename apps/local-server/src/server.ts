import { readReviewedFiles, setFileReviewed } from "./database/reviewed-files.js";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  LocalServerHealth,
  PullRequestDraft,
  PullRequestCacheRead,
  PullRequestCacheWrite,
  ReviewPreferences,
} from "@review/contracts";
import {
  fileReviewKeySchema,
  setFileReviewedSchema,
  draftReferenceSchema,
  pullRequestDiffSchema,
  pullRequestKeySchema,
  pullRequestOverviewSchema,
  savePullRequestDraftSchema,
} from "@review/contracts";
import { z } from "zod";

import type { ReviewDatabase } from "./database/client.js";
import { readPullRequestCache, writePullRequestCache } from "./database/pull-request-cache.js";
import {
  claimPullRequestDraft,
  deletePullRequestDraft,
  finishPullRequestDraft,
  PullRequestDraftConflictError,
  PullRequestDraftNotFoundError,
  readPullRequestDetailDocument,
  readPullRequestDrafts,
  savePullRequestDraft,
  writePullRequestDetailDocument,
  type DetailDocument,
} from "./database/pull-request-drafts.js";
import { readUserPreferences, writeUserPreferences } from "./database/user-preferences.js";

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const repositoryRequestSchema = z.object({
  repositories: z.array(z.string().regex(repositoryPattern)).max(50),
});
const pullRequestStatusSchema = z.enum([
  "draft",
  "open",
  "inReview",
  "approved",
  "merged",
  "closed",
]);
const preferencesSchema = z.object({
  repositories: z.array(z.string().regex(repositoryPattern)).max(50),
  pullRequestStatuses: z.array(pullRequestStatusSchema).max(6),
  setupComplete: z.boolean(),
});
type JsonResponse =
  | LocalServerHealth
  | PullRequestCacheRead
  | PullRequestDraft
  | PullRequestDraft[]
  | string[]
  | ReviewPreferences
  | { content: DetailDocument | null; fetchedAt: string | null }
  | { error: string }
  | { ok: true };

const detailDocumentReadSchema = z.object({
  key: pullRequestKeySchema,
  kind: z.enum(["overview", "diff"]),
  revisionKey: z.string().min(1),
});
const detailDocumentWriteSchema = z.discriminatedUnion("kind", [
  z.object({
    key: pullRequestKeySchema,
    kind: z.literal("overview"),
    revisionKey: z.string().min(1),
    content: pullRequestOverviewSchema,
  }),
  z.object({
    key: pullRequestKeySchema,
    kind: z.literal("diff"),
    revisionKey: z.string().min(1),
    content: pullRequestDiffSchema,
  }),
]);
const draftFinishSchema = draftReferenceSchema.extend({
  status: z.enum(["draft", "submitted", "uncertain"]),
  error: z.string().nullable(),
  remoteUrl: z.string().url().nullable(),
});

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, value: JsonResponse): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readRepositories(body: string): string[] | null {
  return parseBody(body, repositoryRequestSchema)?.repositories ?? null;
}

function parseBody<Value>(body: string, schema: z.ZodType<Value>): Value | null {
  try {
    const result = schema.safeParse(JSON.parse(body));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function sendDraftMutation(response: ServerResponse, mutate: () => JsonResponse): void {
  try {
    sendJson(response, 200, mutate());
  } catch (error) {
    if (error instanceof PullRequestDraftNotFoundError) {
      sendJson(response, 404, { error: error.message });
      return;
    }
    if (error instanceof PullRequestDraftConflictError) {
      sendJson(response, 409, { error: error.message });
      return;
    }
    sendJson(response, 500, { error: "Unable to update pull request details." });
  }
}

function handleReviewedFilesRequest(route: string, body: string, response: ServerResponse, reviewDatabase: ReviewDatabase): boolean {
  switch (route) {
    case "POST /pull-requests/details/reviewed/read": {
      const input = parseBody(body, fileReviewKeySchema);
      if (!input) sendJson(response, 400, { error: "Invalid review key" });
      else sendJson(response, 200, readReviewedFiles(reviewDatabase, input));
      return true;
    }
    case "PUT /pull-requests/details/reviewed/write": {
      const input = parseBody(body, setFileReviewedSchema);
      if (!input) sendJson(response, 400, { error: "Invalid file review" });
      else {
        setFileReviewed(reviewDatabase, input);
        sendJson(response, 200, { ok: true });
      }
      return true;
    }
    default: return false;
  }
}

async function handlePullRequestDetailsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  reviewDatabase: ReviewDatabase,
): Promise<boolean> {
  if (!request.url?.startsWith("/pull-requests/details/")) {
    return false;
  }
  const body = await readBody(request);
  const route = `${request.method} ${request.url}`;
  if (handleReviewedFilesRequest(route, body, response, reviewDatabase)) return true;
  switch (route) {
    case "POST /pull-requests/details/drafts/read": {
      const input = parseBody(body, pullRequestKeySchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request key" });
      } else {
        sendJson(response, 200, readPullRequestDrafts(reviewDatabase, input));
      }
      return true;
    }
    case "PUT /pull-requests/details/drafts/save": {
      const input = parseBody(body, savePullRequestDraftSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request draft" });
      } else {
        sendDraftMutation(response, () => savePullRequestDraft(reviewDatabase, input));
      }
      return true;
    }
    case "POST /pull-requests/details/drafts/delete": {
      const input = parseBody(body, draftReferenceSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request draft reference" });
      } else {
        sendDraftMutation(response, () => {
          deletePullRequestDraft(reviewDatabase, input);
          return { ok: true };
        });
      }
      return true;
    }
    case "POST /pull-requests/details/drafts/claim": {
      const input = parseBody(body, draftReferenceSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request draft reference" });
      } else {
        sendDraftMutation(response, () => claimPullRequestDraft(reviewDatabase, input));
      }
      return true;
    }
    case "POST /pull-requests/details/drafts/finish": {
      const input = parseBody(body, draftFinishSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request draft result" });
      } else {
        sendDraftMutation(response, () => finishPullRequestDraft(reviewDatabase, input));
      }
      return true;
    }
    case "POST /pull-requests/details/documents/read": {
      const input = parseBody(body, detailDocumentReadSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request detail document reference" });
      } else {
        sendJson(response, 200, readPullRequestDetailDocument(
          reviewDatabase,
          input.key,
          input.kind,
          input.revisionKey,
        ));
      }
      return true;
    }
    case "PUT /pull-requests/details/documents/write": {
      const input = parseBody(body, detailDocumentWriteSchema);
      if (!input) {
        sendJson(response, 400, { error: "Invalid pull request detail document" });
      } else {
        writePullRequestDetailDocument(reviewDatabase, input);
        sendJson(response, 200, { ok: true });
      }
      return true;
    }
    default:
      sendJson(response, 404, { error: "Not found" });
      return true;
  }
}

export function createReviewServer(reviewDatabase: ReviewDatabase) {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const body = JSON.stringify({
        ok: true,
        databasePath: reviewDatabase.path,
      } satisfies LocalServerHealth);

      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
      });
      response.end(body);
      return;
    }

    if (request.method === "POST" && request.url === "/pull-requests/cache/read") {
      const repositories = readRepositories(await readBody(request));
      if (!repositories) {
        sendJson(response, 400, { error: "Invalid repositories" });
        return;
      }
      sendJson(response, 200, readPullRequestCache(reviewDatabase, repositories));
      return;
    }

    if (await handlePullRequestDetailsRequest(request, response, reviewDatabase)) {
      return;
    }

    if (request.method === "GET" && request.url === "/preferences") {
      sendJson(response, 200, readUserPreferences(reviewDatabase));
      return;
    }

    if (request.method === "PUT" && request.url === "/preferences") {
      try {
        const result = preferencesSchema.safeParse(JSON.parse(await readBody(request)));
        if (!result.success) {
          sendJson(response, 400, { error: "Invalid preferences" });
          return;
        }
        writeUserPreferences(reviewDatabase, result.data);
        sendJson(response, 200, { ok: true });
      } catch {
        sendJson(response, 400, { error: "Invalid preferences" });
      }
      return;
    }

    if (request.method === "PUT" && request.url === "/pull-requests/cache") {
      try {
        // SAFETY: The local Electron main process creates this payload from normalized GitHub data.
        const payload = JSON.parse(await readBody(request)) as PullRequestCacheWrite;
        writePullRequestCache(reviewDatabase, payload);
        sendJson(response, 200, { ok: true });
      } catch {
        sendJson(response, 400, { error: "Invalid pull request cache payload" });
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}
