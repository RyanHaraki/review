import {
  defaultPullRequestStatuses,
  type ReviewPreferences,
} from "@review/contracts";
import { z } from "zod";

import type { ReviewDatabase } from "./client.js";

const userPreferencesRowSchema = z.object({
  repositories_json: z.string(),
  pull_request_statuses_json: z.string(),
  setup_complete: z.number().int().min(0).max(1),
});
const storedPreferencesSchema = z.object({
  repositories: z.array(z.string()),
  pullRequestStatuses: z.array(z.enum([
    "draft",
    "open",
    "inReview",
    "approved",
    "merged",
    "closed",
  ])),
  setupComplete: z.boolean(),
});

export function readUserPreferences(reviewDatabase: ReviewDatabase): ReviewPreferences {
  const storedRow = reviewDatabase.database.prepare(`
    SELECT repositories_json, pull_request_statuses_json, setup_complete
    FROM user_preferences
    WHERE id = 1
  `).get();

  if (!storedRow) {
    return {
      repositories: [],
      pullRequestStatuses: [...defaultPullRequestStatuses],
      setupComplete: false,
    };
  }

  const row = userPreferencesRowSchema.parse(storedRow);
  return storedPreferencesSchema.parse({
    repositories: JSON.parse(row.repositories_json),
    pullRequestStatuses: JSON.parse(row.pull_request_statuses_json),
    setupComplete: row.setup_complete === 1,
  });
}

export function writeUserPreferences(
  reviewDatabase: ReviewDatabase,
  preferences: ReviewPreferences,
): void {
  reviewDatabase.database.prepare(`
    INSERT INTO user_preferences (
      id, repositories_json, pull_request_statuses_json, setup_complete, updated_at
    ) VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      repositories_json = excluded.repositories_json,
      pull_request_statuses_json = excluded.pull_request_statuses_json,
      setup_complete = excluded.setup_complete,
      updated_at = excluded.updated_at
  `).run(
    JSON.stringify(preferences.repositories),
    JSON.stringify(preferences.pullRequestStatuses),
    Number(preferences.setupComplete),
    new Date().toISOString(),
  );
}
