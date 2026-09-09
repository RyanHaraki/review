import type { FileReviewKey, SetFileReviewed } from "@review/contracts";
import { z } from "zod";
import type { ReviewDatabase } from "./client.js";

export function readReviewedFiles({ database }: ReviewDatabase, input: FileReviewKey): string[] {
  const rows = database.prepare(`SELECT path FROM pull_request_reviewed_files
    WHERE repository = ? AND pull_request_number = ? AND base_sha = ? AND head_sha = ? ORDER BY path`)
    .all(input.key.repository, input.key.number, input.baseSha, input.headSha);
  return z.array(z.object({ path: z.string() })).parse(rows).map((row) => row.path);
}

export function setFileReviewed({ database }: ReviewDatabase, input: SetFileReviewed): void {
  const values = [input.key.repository, input.key.number, input.baseSha, input.headSha, input.path];
  if (input.reviewed) {
    database.prepare(`INSERT OR IGNORE INTO pull_request_reviewed_files
      (repository, pull_request_number, base_sha, head_sha, path) VALUES (?, ?, ?, ?, ?)`).run(...values);
  } else {
    database.prepare(`DELETE FROM pull_request_reviewed_files
      WHERE repository = ? AND pull_request_number = ? AND base_sha = ? AND head_sha = ? AND path = ?`).run(...values);
  }
}
