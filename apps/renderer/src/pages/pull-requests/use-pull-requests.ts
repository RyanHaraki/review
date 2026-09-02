import type { PullRequestGroup } from "@review/contracts";
import { useCallback, useEffect, useState } from "react";

type PullRequestListState = {
  groups: PullRequestGroup[];
  loading: boolean;
};

export function usePullRequests(repositories: string[]) {
  const [state, setState] = useState<PullRequestListState>({ groups: [], loading: true });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: current.groups.length === 0 }));
    try {
      const groups = await window.reviewDesktop.listPullRequests(repositories);
      setState({ groups, loading: false });
    } catch {
      setState({
        groups: repositories.map((repository) => ({
          repository,
          state: "unavailable",
          pullRequests: [],
        })),
        loading: false,
      });
    }
  }, [repositories]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
