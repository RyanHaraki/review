import { z } from "zod";
import {
  pullRequestDiffSchema,
  pullRequestOverviewSchema,
  type PullRequestKey,
} from "@review/contracts";
import {
  readRemoteDetail,
  readRemoteDiff,
  readRemoteOverview,
  type GitHubRequest,
} from "./pull-request-github.js";
import type { LocalRequest } from "./pull-request-submissions.js";

export async function readOverviewDocument(
  key: PullRequestKey,
  github: GitHubRequest,
  local: LocalRequest,
) {
  const overview = pullRequestOverviewSchema.parse(
    await readRemoteOverview(key, github),
  );
  try {
    await local(
      "documents/write",
      { key, kind: "overview", revisionKey: "current", content: overview },
      "PUT",
    );
  } catch {
    // GitHub is the source of published data. Cache failure must not hide it.
  }
  return overview;
}

export async function readDiffDocument(
  key: PullRequestKey,
  github: GitHubRequest,
  local: LocalRequest,
) {
  const detail = (await readRemoteDetail(key, github)).repository.pullRequest;
  const revisionKey = `${detail.baseRefOid}:${detail.headRefOid}`;
  try {
    const cached = z
      .object({
        content: pullRequestDiffSchema.nullable(),
        fetchedAt: z.string().nullable(),
      })
      .parse(await local("documents/read", { key, kind: "diff", revisionKey }));
    if (
      cached.content?.baseSha === detail.baseRefOid &&
      cached.content.headSha === detail.headRefOid
    )
      return cached.content;
  } catch {
    // An unavailable cache is a miss. Read the authoritative GitHub response.
  }
  const diff = pullRequestDiffSchema.parse(await readRemoteDiff(key, github));
  try {
    await local(
      "documents/write",
      {
        key,
        kind: "diff",
        revisionKey: `${diff.baseSha}:${diff.headSha}`,
        content: diff,
      },
      "PUT",
    );
  } catch {
    // A large response can exceed the cache limit and still be displayed.
  }
  return diff;
}
