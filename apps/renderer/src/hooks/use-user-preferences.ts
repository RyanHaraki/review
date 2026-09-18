import type { ReviewPreferences } from "@review/contracts";
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readPreferences, savePreferences } from "../pages/setup/setup-persistence";
import { useGitHubSession } from "../session/use-github-session";
import { githubSession } from "../session/github-session-store";

export function useUserPreferences() {
  const { status, generation } = useGitHubSession();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["preferences"], queryFn: readPreferences, enabled: status?.state === "connected" });
  const mutation = useMutation({
    mutationFn: (next: ReviewPreferences) => {
      if (githubSession.getSnapshot().generation !== generation) throw new Error("The GitHub account changed. Reload your preferences.");
      return savePreferences(next);
    },
    scope: { id: "preferences" },
    onMutate(next) { client.setQueryData(["preferences"], next); },
  });
  const { mutateAsync } = mutation;
  const updatePreferences = useCallback(async (next: ReviewPreferences) => { await mutateAsync(next); }, [mutateAsync]);
  return { preferences: query.data ?? null, preferenceError: query.isError || mutation.isError, updatePreferences };
}
