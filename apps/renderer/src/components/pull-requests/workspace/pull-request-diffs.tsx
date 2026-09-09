import { useCallback } from "react";
import type { PullRequestKey } from "@review/contracts";
import { usePullRequestDiff } from "../../../pages/pull-requests/use-pull-request-diff";
import { usePullRequestOverview } from "../../../pages/pull-requests/use-pull-request-overview";
import { usePullRequestDrafts } from "../../../pages/pull-requests/use-pull-request-drafts";
import { Button } from "../../ui/button";
import { PullRequestDiffView } from "./pull-request-diff-view";

type PullRequestDiffsProps = { pullRequestKey: PullRequestKey };

export function PullRequestDiffs({ pullRequestKey }: PullRequestDiffsProps) {
  const query = usePullRequestDiff(pullRequestKey);
  const overview = usePullRequestOverview(pullRequestKey);
  const drafts = usePullRequestDrafts(pullRequestKey);
  const refresh = useCallback(() => {
    void Promise.allSettled([query.refetch(), overview.refetch(), drafts.refetch()]);
  }, [query.refetch, overview.refetch, drafts.refetch]);
  const errors = [query.error, overview.error, drafts.error].filter((error) => error !== null);
  if (query.isPending) return <p className="py-12 text-sm text-text-secondary" role="status">Loading changed files…</p>;
  if (!query.data) return <div className="space-y-3 py-8"><p role="alert" className="text-sm text-red-700">{query.error?.message ?? "Could not load diffs."}</p><Button onClick={refresh} variant="outline">Try again</Button></div>;
  return <div className="space-y-3">
    {errors.map((error) => <p key={error.message} role="alert" className="text-sm text-red-700">{error.message}</p>)}
    <PullRequestDiffView key={`${query.data.baseSha}:${query.data.headSha}`} pullRequestKey={pullRequestKey} diff={query.data} threads={overview.data?.threads ?? []} drafts={drafts.data ?? []} commentsLoading={overview.isPending || drafts.isPending} refreshing={query.isFetching || overview.isFetching} refresh={refresh} />
  </div>;
}
