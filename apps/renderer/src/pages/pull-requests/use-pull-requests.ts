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
    groups: query.data ?? [],
    loading: query.isPending,
    refresh: query.refetch,
    refreshing: query.isFetching,
  };
}
