import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openReviewDatabase } from "./client.js";
import { readPullRequestCache, writePullRequestCache } from "./pull-request-cache.js";

test("creates the initial SQLite schema", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-database-"));

  try {
    const reviewDatabase = openReviewDatabase(directory);
    const tableNames = reviewDatabase.database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));

    assert.ok(tableNames.includes("repositories"));
    assert.ok(tableNames.includes("pull_requests"));
    assert.ok(tableNames.includes("pull_request_summaries"));
    assert.ok(tableNames.includes("review_revisions"));
    assert.ok(tableNames.includes("threads"));
    assert.ok(tableNames.includes("messages"));

    const journalMode = reviewDatabase.database.prepare("PRAGMA journal_mode").get();
    assert.equal(journalMode?.journal_mode, "wal");
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("caches pull request summaries for a selected repository", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-pull-request-cache-"));

  try {
    const reviewDatabase = openReviewDatabase(directory);
    writePullRequestCache(reviewDatabase, {
      groups: [{
        repository: "openai/example",
        state: "ready",
        pullRequests: [{
          repository: "openai/example",
          githubId: "123",
          number: 7,
          title: "Keep the list current",
          authorLogin: "octocat",
          authorAvatarUrl: "https://avatars.githubusercontent.com/octocat?size=64",
          additions: 12,
          deletions: 3,
          updatedAt: "2026-09-01T12:00:00.000Z",
          isDraft: false,
          url: "https://github.com/openai/example/pull/7",
          headRefName: "refresh-list",
          baseSha: "base",
          headSha: "head",
          reviewState: "approved",
        }],
      }],
    });

    const cached = readPullRequestCache(reviewDatabase, ["openai/example"]);
    assert.deepEqual(cached.freshRepositories, ["openai/example"]);
    assert.deepEqual(cached.cachedRepositories, ["openai/example"]);
    assert.equal(cached.groups[0]?.pullRequests[0]?.title, "Keep the list current");
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
