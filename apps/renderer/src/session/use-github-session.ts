import { useSyncExternalStore } from "react";
import { githubSession } from "./github-session-store";

export function useGitHubSession() {
  return useSyncExternalStore(githubSession.subscribe, githubSession.getSnapshot);
}
