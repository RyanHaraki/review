import type { PullRequestKey } from "@review/contracts";
import { useQuery } from "@tanstack/react-query";

export function usePullRequestDrafts(key: PullRequestKey) {
  return useQuery({
    queryKey: ["pull-request-drafts", key.repository, key.number],
    queryFn: () => window.reviewDesktop.listPullRequestDrafts(key),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
