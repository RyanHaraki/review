import { useGitHubSession } from "./use-github-session";
import { SessionWorkspace } from "./session-workspace";

export function SessionApplication() {
  const { status, generation } = useGitHubSession();
  if (!status) return <p role="status" className="p-8 text-sm text-text-secondary">Loading Review…</p>;
  return <SessionWorkspace key={generation} />;
}
