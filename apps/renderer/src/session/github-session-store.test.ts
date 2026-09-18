import { expect, test, vi } from "vitest";
import type { GitHubSetupStatus } from "@review/contracts";
import { createGitHubSessionStore } from "./github-session-store";

const accountA: GitHubSetupStatus = { state: "connected", account: { id: "42", login: "alice", avatarUrl: null } };
const accountB: GitHubSetupStatus = { state: "connected", account: { id: "43", login: "bob", avatarUrl: null } };

function fixture(read: () => Promise<GitHubSetupStatus>) {
  const listeners = new Set<(status: GitHubSetupStatus) => void>();
  const bridge = {
    readGitHubSession: vi.fn(read),
    onGitHubSessionChanged: vi.fn((listener: (status: GitHubSetupStatus) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }),
  };
  return {
    bridge,
    store: createGitHubSessionStore(() => bridge),
    emit(status: GitHubSetupStatus) { for (const listener of listeners) listener(status); },
  };
}

test("logout and reconnect to the same account replace the workspace generation", async () => {
  const { store, emit, bridge } = fixture(async () => accountA);
  await Promise.all([store.initialize(), store.initialize()]);
  expect(bridge.onGitHubSessionChanged).toHaveBeenCalledTimes(1);
  expect(bridge.readGitHubSession).toHaveBeenCalledTimes(1);
  const firstGeneration = store.getSnapshot().generation;
  emit({ ...accountA });
  expect(store.getSnapshot().generation).toBe(firstGeneration);
  emit({ state: "disconnected", message: null });
  expect(store.getSnapshot().generation).toBe(firstGeneration + 1);
  emit(accountA);
  expect(store.getSnapshot().generation).toBe(firstGeneration + 2);
  emit(accountB);
  expect(store.getSnapshot().generation).toBe(firstGeneration + 3);
});

test("a late initial read cannot restore private account data after a sign-out event", async () => {
  const pending = Promise.withResolvers<GitHubSetupStatus>();
  const { store, emit } = fixture(() => pending.promise);
  const initialize = store.initialize();
  const listener = vi.fn();
  const unsubscribe = store.subscribe(listener);
  emit({ state: "disconnected", message: "Sign in again." });
  pending.resolve(accountA);
  await initialize;
  expect(store.getSnapshot().status).toEqual({ state: "disconnected", message: "Sign in again." });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  emit(accountB);
  expect(listener).toHaveBeenCalledTimes(1);
});

test("device flow updates keep the current setup workspace and surface load failures", async () => {
  const { store, emit } = fixture(async () => { throw new Error("Storage unavailable"); });
  await store.initialize();
  expect(store.getSnapshot().status).toEqual({ state: "disconnected", message: "Storage unavailable" });
  const generation = store.getSnapshot().generation;
  emit({ state: "authorizing", userCode: "ABCD-EFGH", verificationUri: "https://github.com/login/device", expiresAt: "2026-09-18T00:00:00Z" });
  expect(store.getSnapshot().generation).toBe(generation);
  emit({ state: "disconnected", message: "Sign-in expired." });
  expect(store.getSnapshot().generation).toBe(generation);
});
