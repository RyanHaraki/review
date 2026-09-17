import { processFile, type FileDiffMetadata } from "@pierre/diffs";
import type { PullRequestDiffFile } from "@review/contracts";

export type DiffContent =
  | { kind: "ready"; metadata: FileDiffMetadata }
  | { kind: "unavailable"; message: string };

export function parseDiffFile(file: PullRequestDiffFile, revision: string): DiffContent {
  if (!file.patch) {
    return {
      kind: "unavailable",
      message: file.additions + file.deletions === 0
        ? "No text changes. This file may have been renamed or its metadata changed."
        : "GitHub did not provide a text diff for this file. It may be binary or too large.",
    };
  }
  const oldPath = file.status === "added" ? "/dev/null" : "a/file";
  const newPath = file.status === "removed" ? "/dev/null" : "b/file";
  try {
    const metadata = processFile(`--- ${oldPath}\n+++ ${newPath}\n${file.patch}\n`, {
      isGitDiff: false,
      cacheKey: `${revision}:${file.path}`,
      throwOnError: true,
    });
    if (!metadata || metadata.hunks.length === 0) {
      return { kind: "unavailable", message: "This file has no viewable text changes." };
    }
    metadata.name = file.path;
    if (file.status === "added") metadata.type = "new";
    if (file.status === "removed") metadata.type = "deleted";
    if (file.status === "renamed") metadata.type = "rename-changed";
    if (file.previousPath) metadata.prevName = file.previousPath;
    return { kind: "ready", metadata };
  } catch {
    return { kind: "unavailable", message: "GitHub returned an incomplete diff. Open the file on GitHub to view it." };
  }
}
