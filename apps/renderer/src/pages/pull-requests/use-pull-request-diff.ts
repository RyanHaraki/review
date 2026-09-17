import type { PullRequestKey } from "@review/contracts";
import { useQuery } from "@tanstack/react-query";

export function usePullRequestDiff(key: PullRequestKey) {
  return useQuery({
    queryKey: ["pullRequestDiff", key.repository, key.number],
    queryFn: () => window.reviewDesktop.readPullRequestDiff(key),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
