import type {
  PullRequestCacheRead,
  PullRequestCacheWrite,
  PullRequestGroup,
  PullRequestReviewState,
  PullRequestStatus,
  PullRequestSummary,
} from "@review/contracts";

import type { ReviewDatabase } from "./client.js";

const cacheLifetimeMilliseconds = 5 * 60 * 1000;

type PullRequestSummaryRow = {
  repository: string;
  github_id: string;
  number: number;
  title: string;
  author_login: string;
  author_avatar_url: string | null;
  additions: number;
  deletions: number;
  updated_at: string;
  is_draft: number;
  url: string;
  head_ref_name: string;
  base_sha: string;
  head_sha: string;
  review_state: PullRequestReviewState;
  status: PullRequestStatus;
};

function toPullRequestSummary(row: PullRequestSummaryRow): PullRequestSummary {
  return {
    repository: row.repository,
    githubId: row.github_id,
    number: row.number,
    title: row.title,
    authorLogin: row.author_login,
    authorAvatarUrl: row.author_avatar_url,
    additions: row.additions,
    deletions: row.deletions,
    updatedAt: row.updated_at,
    isDraft: row.is_draft === 1,
    url: row.url,
    headRefName: row.head_ref_name,
    baseSha: row.base_sha,
    headSha: row.head_sha,
    reviewState: row.review_state,
    status: row.status,
  };
}

export function readPullRequestCache(
  reviewDatabase: ReviewDatabase,
  repositories: string[],
): PullRequestCacheRead {
  const database = reviewDatabase.database;
  const readSummaries = database.prepare(`
    SELECT repository, github_id, number, title, author_login, author_avatar_url,
      additions, deletions, updated_at, is_draft, url, head_ref_name, base_sha,
      head_sha, review_state, status
    FROM pull_request_summaries
    WHERE repository = ?
    ORDER BY updated_at DESC
  `);
  const readSync = database.prepare("SELECT updated_at FROM sync_state WHERE key = ?");
  const freshRepositories: string[] = [];
  const cachedRepositories: string[] = [];
  const groups = repositories.map((repository): PullRequestGroup => {
    // SAFETY: The query selects every field in PullRequestSummaryRow with fixed SQLite aliases.
    const rows = readSummaries.all(repository) as PullRequestSummaryRow[];
    // SAFETY: This query returns no row or one row with an updated_at string.
    const sync = readSync.get(`pull-requests:${repository}`) as { updated_at: string } | undefined;
    if (sync) {
      cachedRepositories.push(repository);
    }
    const updatedAt = sync ? Date.parse(sync.updated_at) : Number.NaN;
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < cacheLifetimeMilliseconds) {
      freshRepositories.push(repository);
    }

    return {
      repository,
      state: "ready",
      pullRequests: rows.map(toPullRequestSummary),
    };
  });

  return { groups, freshRepositories, cachedRepositories };
}

export function writePullRequestCache(
  reviewDatabase: ReviewDatabase,
  payload: PullRequestCacheWrite,
): void {
  const database = reviewDatabase.database;
  const deleteSummaries = database.prepare("DELETE FROM pull_request_summaries WHERE repository = ?");
  const insertSummary = database.prepare(`
    INSERT INTO pull_request_summaries (
      repository, github_id, number, title, author_login, author_avatar_url,
      additions, deletions, updated_at, is_draft, url, head_ref_name, base_sha,
      head_sha, review_state, status, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const writeSync = database.prepare(`
    INSERT INTO sync_state (key, value_json, updated_at)
    VALUES (?, '{}', ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);

  database.exec("BEGIN IMMEDIATE;");
  try {
    for (const group of payload.groups) {
      if (group.state !== "ready") {
        continue;
      }
      const fetchedAt = new Date().toISOString();
      deleteSummaries.run(group.repository);
      for (const pullRequest of group.pullRequests) {
        insertSummary.run(
          group.repository,
          pullRequest.githubId,
          pullRequest.number,
          pullRequest.title,
          pullRequest.authorLogin,
          pullRequest.authorAvatarUrl,
          pullRequest.additions,
          pullRequest.deletions,
          pullRequest.updatedAt,
          Number(pullRequest.isDraft),
          pullRequest.url,
          pullRequest.headRefName,
          pullRequest.baseSha,
          pullRequest.headSha,
          pullRequest.reviewState,
          pullRequest.status,
          fetchedAt,
        );
      }
      writeSync.run(`pull-requests:${group.repository}`, fetchedAt);
    }
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
