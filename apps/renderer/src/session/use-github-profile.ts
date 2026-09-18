import { useQuery } from "@tanstack/react-query";
import { useGitHubSession } from "./use-github-session";

export function useGitHubProfile() {
  const { status, generation } = useGitHubSession();
  const account = status?.state === "connected" ? status.account : null;
  const profile = useQuery({
    queryKey: ["github-profile", account?.id, generation],
    queryFn: () => window.reviewDesktop.readGitHubProfile(),
    enabled: account !== null,
    staleTime: 5 * 60 * 1000,
  });
  return { account, profile: profile.data };
}
