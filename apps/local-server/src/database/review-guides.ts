import { guideStateSchema, type GuideKey, type GuideState } from "@review/contracts";

import type { ReviewDatabase } from "./client.js";

export function readReviewGuide({ database }: ReviewDatabase, key: GuideKey): GuideState {
  const row = database.prepare(`
    SELECT state_json FROM review_guides
    WHERE repository = ? AND pull_request_number = ? AND base_sha = ? AND head_sha = ?
  `).get(key.repository, key.number, key.baseSha, key.headSha);
  return row ? guideStateSchema.parse(JSON.parse(String(row.state_json))) : { kind: "missing" };
}

export function writeReviewGuide(
  { database }: ReviewDatabase,
  key: GuideKey,
  state: GuideState,
): void {
  database.prepare(`
    INSERT INTO review_guides
      (repository, pull_request_number, base_sha, head_sha, state_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository, pull_request_number, base_sha, head_sha)
    DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(key.repository, key.number, key.baseSha, key.headSha, JSON.stringify(state), new Date().toISOString());
}
