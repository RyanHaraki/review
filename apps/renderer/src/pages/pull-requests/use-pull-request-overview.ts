import type { PullRequestKey } from "@review/contracts";
import { useQuery } from "@tanstack/react-query";

export function usePullRequestOverview(key: PullRequestKey) {
  return useQuery({
    queryKey: ["pull-request-overview", key.repository, key.number],
    queryFn: () => window.reviewDesktop.readPullRequestOverview(key),
    staleTime: 30_000,
  });
}
