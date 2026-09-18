import type { DesktopBridge, GitHubSetupStatus } from "@review/contracts";

type SessionSnapshot = { status: GitHubSetupStatus | null; generation: number };
type SessionBridge = Pick<DesktopBridge, "readGitHubSession" | "onGitHubSessionChanged">;

export function createGitHubSessionStore(bridge: () => SessionBridge) {
  let snapshot: SessionSnapshot = { status: null, generation: 0 };
  let initialized: Promise<void> | undefined;
  let eventVersion = 0;
  const listeners = new Set<() => void>();
  function update(status: GitHubSetupStatus) {
    const previous = snapshot.status?.state === "connected" ? snapshot.status.account.id : null;
    const next = status.state === "connected" ? status.account.id : null;
    snapshot = { status, generation: snapshot.generation + Number(previous !== next) };
    for (const listener of listeners) listener();
  }
  async function start() {
    bridge().onGitHubSessionChanged((status) => {
      eventVersion += 1;
      update(status);
    });
    const version = eventVersion;
    try {
      const status = await bridge().readGitHubSession();
      if (eventVersion === version) update(status);
    } catch (error) {
      if (eventVersion === version) update({
        state: "disconnected",
        message: error instanceof Error ? error.message : "Unable to read GitHub sign-in. Try again.",
      });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize() { initialized ??= start(); return initialized; },
  };
}

export const githubSession = createGitHubSessionStore(() => window.reviewDesktop);
