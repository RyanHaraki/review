import type { PullRequestGroup } from "@review/contracts";
import { useQuery } from "@tanstack/react-query";

export function usePullRequests(repositories: string[]) {
  const query = useQuery({
    enabled: repositories.length > 0,
    queryFn: () => window.reviewDesktop.listPullRequests(repositories),
    queryKey: ["pullRequests", repositories],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  return {
    // SAFETY: the listPullRequests IPC endpoint always returns PullRequestGroup[] for this query shape.
    groups: query.data ?? [] as PullRequestGroup[],
    loading: query.isPending,
    refresh: query.refetch,
    refreshing: query.isFetching,
  };
}
