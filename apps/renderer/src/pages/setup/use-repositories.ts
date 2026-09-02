import type { GitHubRepositoryChoice } from "@review/contracts";
import { useEffect, useState } from "react";

export function useRepositories(enabled: boolean) {
  const [choices, setChoices] = useState<GitHubRepositoryChoice[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError(false);
    try {
      setChoices(await window.reviewDesktop.listGitHubRepositories());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      void refresh();
    }
  }, [enabled]);
  return { choices, loading, error, refresh };
}
