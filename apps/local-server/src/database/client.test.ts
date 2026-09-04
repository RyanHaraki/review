import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { openReviewDatabase } from "./client.js";
import { readPullRequestCache, writePullRequestCache } from "./pull-request-cache.js";
import { migration001, migration002, migration003, migration004 } from "./schema.js";
import { readUserPreferences, writeUserPreferences } from "./user-preferences.js";

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
    assert.ok(tableNames.includes("user_preferences"));
    assert.ok(tableNames.includes("review_revisions"));
    assert.ok(tableNames.includes("threads"));
    assert.ok(tableNames.includes("messages"));

    const summaryColumns = reviewDatabase.database
      .prepare("PRAGMA table_info(pull_request_summaries)")
      .all()
      .map((row) => String(row.name));
    assert.ok(summaryColumns.includes("status"));
    assert.ok(summaryColumns.includes("base_ref_name"));
    assert.ok(summaryColumns.includes("changed_files"));

    const journalMode = reviewDatabase.database.prepare("PRAGMA journal_mode").get();
    assert.equal(journalMode?.journal_mode, "wal");
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stores user preferences", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-user-preferences-"));

  try {
    const reviewDatabase = openReviewDatabase(directory);
    assert.deepEqual(readUserPreferences(reviewDatabase), {
      repositories: [],
      pullRequestStatuses: ["draft", "open"],
      setupComplete: false,
    });

    writeUserPreferences(reviewDatabase, {
      repositories: ["openai/example"],
      pullRequestStatuses: ["open", "approved"],
      setupComplete: true,
    });

    assert.deepEqual(readUserPreferences(reviewDatabase), {
      repositories: ["openai/example"],
      pullRequestStatuses: ["open", "approved"],
      setupComplete: true,
    });
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migration 005 clears pull request cache sync keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-pull-request-migration-"));

  try {
    const database = new DatabaseSync(join(directory, "review.sqlite"));
    const migrations = [migration001, migration002, migration003, migration004];

    for (const [index, migration] of migrations.entries()) {
      database.exec(migration);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(index + 1, "2026-09-01T12:00:00.000Z");
    }

    database
      .prepare("INSERT INTO sync_state (key, value_json, updated_at) VALUES (?, '{}', ?)")
      .run("pull-requests:openai/example", "2026-09-01T12:00:00.000Z");
    database
      .prepare("INSERT INTO sync_state (key, value_json, updated_at) VALUES (?, '{}', ?)")
      .run("repositories", "2026-09-01T12:00:00.000Z");
    database.close();

    const reviewDatabase = openReviewDatabase(directory);
    assert.equal(
      reviewDatabase.database
        .prepare("SELECT key FROM sync_state WHERE key = ?")
        .get("pull-requests:openai/example"),
      undefined,
    );
    assert.equal(
      reviewDatabase.database.prepare("SELECT key FROM sync_state WHERE key = ?").get("repositories")
        ?.key,
      "repositories",
    );
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
          changedFiles: 4,
          updatedAt: "2026-09-01T12:00:00.000Z",
          isDraft: false,
          url: "https://github.com/openai/example/pull/7",
          headRefName: "refresh-list",
          baseRefName: "main",
          baseSha: "base",
          headSha: "head",
          reviewState: "approved",
          status: "approved",
        }],
      }],
    });

    const cached = readPullRequestCache(reviewDatabase, ["openai/example"]);
    assert.deepEqual(cached.freshRepositories, ["openai/example"]);
    assert.deepEqual(cached.cachedRepositories, ["openai/example"]);
    assert.deepEqual(cached.groups[0]?.pullRequests[0], {
      repository: "openai/example",
      githubId: "123",
      number: 7,
      title: "Keep the list current",
      authorLogin: "octocat",
      authorAvatarUrl: "https://avatars.githubusercontent.com/octocat?size=64",
      additions: 12,
      deletions: 3,
      changedFiles: 4,
      updatedAt: "2026-09-01T12:00:00.000Z",
      isDraft: false,
      url: "https://github.com/openai/example/pull/7",
      headRefName: "refresh-list",
      baseRefName: "main",
      baseSha: "base",
      headSha: "head",
      reviewState: "approved",
      status: "approved",
    });
    reviewDatabase.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
