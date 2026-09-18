import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useGitHubSession } from "../../session/use-github-session";

export type SetupStatusError = "status" | "connect" | null;

export function useSetupStatus() {
  const { status } = useGitHubSession();
  const query = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => window.reviewDesktop.getSetupStatus(),
    refetchInterval: (current) => current.state.data?.codex.state === "connected" ? false : 1500,
  });
  const mutation = useMutation({ mutationFn: () => window.reviewDesktop.connectCodex() });
  const { refetch } = query;
  const { mutateAsync } = mutation;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  const connectCodex = useCallback(async () => { await mutateAsync().catch(() => undefined); }, [mutateAsync]);
  const error: SetupStatusError = mutation.isError ? "connect" : query.isError ? "status" : null;
  return {
    setup: query.data && status ? { ...query.data, github: status } : null,
    checking: query.isFetching,
    connectingCodex: mutation.isPending || (mutation.isSuccess && query.data?.codex.state !== "connected"),
    error, refresh, connectCodex,
  };
}
