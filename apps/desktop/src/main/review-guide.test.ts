import assert from "node:assert/strict";
import test from "node:test";
import type { GuideFile, GuideKey, GuideState } from "@review/contracts";
import { createGuideManager, isGeneratedFile, validateGuideOutline } from "./review-guide.js";

const key: GuideKey = { repository: "example/review", number: 1, baseSha: "a".repeat(40), headSha: "b".repeat(40) };
const file: GuideFile = { path: "src/session.ts", previousPath: null, status: "modified", additions: 2, deletions: 1, patch: "@@ -1 +1 @@\n-old\n+new" };
const ready: GuideState = {
  kind: "ready",
  guide: { chapters: [{ title: "Session changes", explanation: "Changes the session value.", filePaths: [file.path] }], generatedFiles: [], files: [file], generatedAt: "2026-09-17T00:00:00Z" },
};

test("one generation continues without readers and saves its complete result", async () => {
  let saved: GuideState = { kind: "missing" };
  let calls = 0;
  const completion = Promise.withResolvers<GuideState>();
  const persisted = Promise.withResolvers<void>();
  const storage = {
    async read() { return saved; },
    async write(_key: GuideKey, state: GuideState) {
      saved = state;
      if (state.kind === "ready") persisted.resolve();
    },
  };
  const manager = createGuideManager(storage, () => {
    calls += 1;
    return completion.promise;
  });
  const starts = await Promise.all([manager.ensure(key), manager.ensure(key)]);
  assert.equal(starts[0].kind, "generating");
  assert.equal(starts[1].kind, "generating");
  assert.equal(calls, 1);
  completion.resolve(ready);
  await persisted.promise;
  const reopened = createGuideManager(storage, () => { throw new Error("Must use saved result"); });
  assert.deepEqual(await reopened.ensure(key), ready);
});

test("interrupted and failed jobs have an explicit retry path", async () => {
  let saved: GuideState = { kind: "generating", startedAt: "2026-09-17T00:00:00Z" };
  let calls = 0;
  const failed = Promise.withResolvers<void>();
  const manager = createGuideManager({
    async read() { return saved; },
    async write(_key, state) { saved = state; if (state.kind === "failed" && calls > 0) failed.resolve(); },
  }, async () => { calls += 1; throw new Error("Codex disconnected"); });
  assert.equal((await manager.read(key)).kind, "failed");
  assert.equal(calls, 0);
  assert.equal((await manager.ensure(key)).kind, "generating");
  await failed.promise;
  assert.deepEqual(await manager.read(key), { kind: "failed", message: "Codex disconnected" });
});

test("guide validation rejects unknown, duplicate and omitted files", () => {
  for (const paths of [[], ["missing.ts"], [file.path, file.path]]) {
    assert.throws(() => validateGuideOutline({
      chapters: [{ title: "Change", explanation: "A change.", filePaths: paths }], generatedFiles: [],
    }, [file]));
  }
});

test("known generated files move out of ordinary chapters", () => {
  const lock = { ...file, path: "pnpm-lock.yaml" };
  const outline = validateGuideOutline({
    chapters: [{ title: "Session changes", explanation: "Changes the session value.", filePaths: [file.path, lock.path] }],
    generatedFiles: [],
  }, [file, lock]);
  assert.deepEqual(outline.chapters.map((chapter) => chapter.filePaths), [[file.path]]);
  assert.deepEqual(outline.generatedFiles, [lock.path]);
});

test("build source is not hidden as generated output", () => {
  assert.equal(isGeneratedFile({ ...file, path: "src/build/compile.ts" }), false);
  assert.equal(isGeneratedFile({ ...file, patch: '+const label = "Automatically generated files. Do not edit.";' }), false);
});

test("concurrent reads and starts cannot mark an active generation as interrupted", async () => {
  const readResult = Promise.withResolvers<GuideState>();
  const completion = Promise.withResolvers<GuideState>();
  const persisted = Promise.withResolvers<void>();
  let saved: GuideState = { kind: "missing" };
  let reads = 0;
  const manager = createGuideManager({
    async read() { reads += 1; return readResult.promise; },
    async write(_key, state) { saved = state; if (state.kind === "ready") persisted.resolve(); },
  }, () => completion.promise);
  const pendingRead = manager.read(key);
  const pendingStart = manager.ensure(key);
  readResult.resolve({ kind: "missing" });
  await pendingRead;
  await pendingStart;
  assert.equal(reads, 1);
  assert.equal(saved.kind, "generating");
  assert.equal((await manager.read(key)).kind, "generating");
  completion.resolve(ready);
  await persisted.promise;
});
