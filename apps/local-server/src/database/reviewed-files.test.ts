import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openReviewDatabase } from "./client.js";
import { readReviewedFiles, setFileReviewed } from "./reviewed-files.js";

test("reviewed files survive restart and are scoped to the PR and diff revision", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-file-marks-"));
  const input = { key: { repository: "fixture/demo", number: 42 }, baseSha: "base", headSha: "head" };
  let db = openReviewDatabase(directory);
  try {
    setFileReviewed(db, { ...input, path: "src/a.ts", reviewed: true });
    setFileReviewed(db, { ...input, path: "src/a.ts", reviewed: true });
    db.close(); db = openReviewDatabase(directory);
    assert.deepEqual(readReviewedFiles(db, input), ["src/a.ts"]);
    assert.deepEqual(readReviewedFiles(db, { ...input, headSha: "next" }), []);
    assert.deepEqual(readReviewedFiles(db, { ...input, baseSha: "next" }), []);
    assert.deepEqual(readReviewedFiles(db, { ...input, key: { ...input.key, number: 43 } }), []);
    setFileReviewed(db, { ...input, path: "src/a.ts", reviewed: false });
    assert.deepEqual(readReviewedFiles(db, input), []);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
