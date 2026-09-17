import { describe, expect, it } from "vitest";
import type { PullRequestDiffFile } from "@review/contracts";
import { parseDiffFile } from "./diff-model";

const file: PullRequestDiffFile = {
  path: "src/a file.ts", previousPath: null, status: "modified",
  additions: 1, deletions: 1, patch: "@@ -10,2 +10,2 @@\n const keep = true;\n-const old = 1;\n+const next = 2;",
};

describe("GitHub file patch rendering", () => {
  it("retains the filename and original line coordinates", () => {
    const result = parseDiffFile(file, "base:head");
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error(result.message);
    expect(result.metadata.name).toBe(file.path);
    expect(result.metadata.cacheKey).toBe("base:head:src/a file.ts");
    expect(result.metadata.hunks[0]?.additionStart).toBe(10);
    expect(result.metadata.hunks[0]?.deletionStart).toBe(10);
  });
  it("handles added and deleted files with the absent side", () => {
    const added = parseDiffFile({ ...file, status: "added", patch: "@@ -0,0 +1 @@\n+hello" }, "added");
    const removed = parseDiffFile({ ...file, status: "removed", patch: "@@ -1 +0,0 @@\n-hello" }, "removed");
    expect(added.kind === "ready" && added.metadata.type).toBe("new");
    expect(removed.kind === "ready" && removed.metadata.type).toBe("deleted");
  });
  it("does not invent content for binary or missing patches", () => {
    expect(parseDiffFile({ ...file, patch: null }, "missing").kind).toBe("unavailable");
    expect(parseDiffFile({ ...file, patch: "not a valid patch" }, "invalid").kind).toBe("unavailable");
  });
});
