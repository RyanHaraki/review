import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  pullRequestDraftSchema,
  pullRequestOverviewSchema,
  type PullRequestKey,
  type PullRequestOverview,
} from "@review/contracts";
import { z } from "zod";

import { openReviewDatabase } from "./database/client.js";
import { createReviewServer } from "./server.js";

const key: PullRequestKey = { repository: "openai/example", number: 7 };
const overview: PullRequestOverview = {
  body: "# Description",
  updatedAt: "2026-09-07T00:00:00.000Z",
  baseSha: "base",
  headSha: "head",
  canEdit: true,
  viewerLogin: "octocat",
  activity: [],
  threads: [],
};

const draft = {
  id: "63a76528-d3a9-4e1a-a69f-1ba376a4bd3b",
  key,
  target: { kind: "discussion" },
  body: "Please add a test.",
  expectedRevision: 0,
};

async function startServer(directory: string) {
  const reviewDatabase = openReviewDatabase(directory);
  const server = createReviewServer(reviewDatabase);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = z.object({ port: z.number().int().positive() }).parse(server.address());
  return {
    reviewDatabase,
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server: ReturnType<typeof createReviewServer>, reviewDatabase: ReturnType<typeof openReviewDatabase>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  reviewDatabase.close();
}

test("stores and reads a revision-keyed overview document through HTTP", async () => {
  const directory = mkdtempSync(join(tmpdir(), "review-details-http-"));
  const { reviewDatabase, server, origin } = await startServer(directory);

  try {
    const write = await fetch(`${origin}/pull-requests/details/documents/write`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, kind: "overview", revisionKey: "head", content: overview }),
    });
    assert.equal(write.status, 200);

    const read = await fetch(`${origin}/pull-requests/details/documents/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, kind: "overview", revisionKey: "head" }),
    });
    assert.equal(read.status, 200);
    const document = z.object({
      content: pullRequestOverviewSchema,
      fetchedAt: z.string().datetime(),
    }).parse(await read.json());
    assert.deepEqual(document.content, overview);
    assert.ok(document.fetchedAt.length > 0);
  } finally {
    await closeServer(server, reviewDatabase);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("keeps a failed draft submission available through the HTTP API", async () => {
  const directory = mkdtempSync(join(tmpdir(), "review-drafts-http-"));
  const { reviewDatabase, server, origin } = await startServer(directory);

  try {
    const savedResponse = await fetch(`${origin}/pull-requests/details/drafts/save`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    assert.equal(savedResponse.status, 200);
    const saved = pullRequestDraftSchema.parse(await savedResponse.json());

    const staleResponse = await fetch(`${origin}/pull-requests/details/drafts/save`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, body: "Stale", expectedRevision: 0 }),
    });
    assert.equal(staleResponse.status, 409);

    const claimedResponse = await fetch(`${origin}/pull-requests/details/drafts/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, id: saved.id, revision: saved.revision }),
    });
    assert.equal(claimedResponse.status, 200);
    const claimed = pullRequestDraftSchema.parse(await claimedResponse.json());
    assert.equal(claimed.status, "submitting");

    const finishedResponse = await fetch(`${origin}/pull-requests/details/drafts/finish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key,
        id: claimed.id,
        revision: claimed.revision,
        status: "draft",
        error: "GitHub rejected this comment.",
        remoteUrl: null,
      }),
    });
    assert.equal(finishedResponse.status, 200);
    const failed = pullRequestDraftSchema.parse(await finishedResponse.json());
    assert.equal(failed.status, "draft");
    assert.equal(failed.error, "GitHub rejected this comment.");
  } finally {
    await closeServer(server, reviewDatabase);
    rmSync(directory, { recursive: true, force: true });
  }
});
