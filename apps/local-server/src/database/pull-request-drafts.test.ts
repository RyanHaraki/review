import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { PullRequestKey, SavePullRequestDraft } from "@review/contracts";

import { openReviewDatabase } from "./client.js";
import {
  claimPullRequestDraft,
  finishPullRequestDraft,
  readPullRequestDrafts,
  savePullRequestDraft,
} from "./pull-request-drafts.js";

const key: PullRequestKey = { repository: "openai/example", number: 7 };
const draftId = "2dc59c9e-2f6e-49bf-aadf-8d66b9207823";

function makeDraft(expectedRevision: number, body = "First draft"): SavePullRequestDraft {
  return {
    id: draftId,
    key,
    target: { kind: "discussion" },
    body,
    expectedRevision,
  };
}

test("persists drafts, enforces revisions, and recovers an active submit after reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-pull-request-draft-"));

  try {
    let reviewDatabase = openReviewDatabase(directory);
    const saved = savePullRequestDraft(reviewDatabase, makeDraft(0));
    assert.equal(saved.revision, 1);
    assert.equal(saved.status, "draft");

    assert.throws(
      () => savePullRequestDraft(reviewDatabase, makeDraft(0, "Stale write")),
      /changed/i,
    );

    const claimed = claimPullRequestDraft(reviewDatabase, {
      key,
      id: draftId,
      revision: saved.revision,
    });
    assert.equal(claimed.status, "submitting");
    assert.throws(
      () => savePullRequestDraft(reviewDatabase, makeDraft(claimed.revision, "Blocked write")),
      /locked/i,
    );
    reviewDatabase.close();

    reviewDatabase = openReviewDatabase(directory);
    const recovered = readPullRequestDrafts(reviewDatabase, key);
    assert.deepEqual(recovered.map((draft) => draft.status), ["uncertain"]);

    const submitted = finishPullRequestDraft(reviewDatabase, {
      key,
      id: draftId,
      revision: recovered[0]?.revision ?? 0,
      status: "submitted",
      error: null,
      remoteUrl: "https://github.com/openai/example/pull/7#issuecomment-1",
    });
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.remoteUrl, "https://github.com/openai/example/pull/7#issuecomment-1");
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("keeps a failed submit as a draft that can be edited again", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-pull-request-draft-failure-"));

  try {
    const reviewDatabase = openReviewDatabase(directory);
    const saved = savePullRequestDraft(reviewDatabase, makeDraft(0));
    const claimed = claimPullRequestDraft(reviewDatabase, { key, id: draftId, revision: saved.revision });
    const failed = finishPullRequestDraft(reviewDatabase, {
      key,
      id: draftId,
      revision: claimed.revision,
      status: "draft",
      error: "GitHub rejected this comment.",
      remoteUrl: null,
    });
    assert.equal(failed.status, "draft");
    assert.equal(failed.error, "GitHub rejected this comment.");

    const edited = savePullRequestDraft(reviewDatabase, makeDraft(failed.revision, "Corrected draft"));
    assert.equal(edited.body, "Corrected draft");
    assert.equal(edited.error, null);
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
