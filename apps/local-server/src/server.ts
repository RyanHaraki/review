import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  LocalServerHealth,
  PullRequestCacheRead,
  PullRequestCacheWrite,
  ReviewPreferences,
} from "@review/contracts";
import { z } from "zod";

import type { ReviewDatabase } from "./database/client.js";
import { readPullRequestCache, writePullRequestCache } from "./database/pull-request-cache.js";
import { readUserPreferences, writeUserPreferences } from "./database/UserPreferences.js";

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
  | ReviewPreferences
  | { error: string }
  | { ok: true };

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
  try {
    const result = repositoryRequestSchema.safeParse(JSON.parse(body));
    return result.success ? result.data.repositories : null;
  } catch {
    return null;
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
