import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export function useRepositories(enabled: boolean) {
  const query = useQuery({ queryKey: ["github-repositories"], queryFn: () => window.reviewDesktop.listGitHubRepositories(), enabled });
  const { refetch } = query;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  return { choices: query.data ?? [], loading: enabled && query.isFetching, error: query.isError, refresh };
}
