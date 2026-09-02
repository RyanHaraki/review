import type { SetupStatus } from "@review/contracts";
import { z } from "zod/mini";

const setupStorageKey = "review.setup-status";
const repositorySelectionKey = "review.selected-repositories";
const setupCompleteKey = "review.setup-complete";
const preferencesKey = "review.preferences";
const connectionStateSchema = z.enum(["connected", "disconnected", "unavailable"]);
const setupStatusSchema = z.object({
  github: z.object({
    state: connectionStateSchema,
    login: z.nullable(z.string()),
  }),
  codex: z.object({
    state: connectionStateSchema,
    account: z.nullable(
      z.union([
        z.object({
          type: z.literal("chatgpt"),
          email: z.nullable(z.string()),
          plan: z.string(),
        }),
        z.object({ type: z.literal("apiKey") }),
        z.object({ type: z.literal("amazonBedrock") }),
      ]),
    ),
  }),
});
const repositorySelectionSchema = z.array(z.string());
const preferencesSchema = z.object({
  repositories: repositorySelectionSchema,
});

export type ReviewPreferences = z.infer<typeof preferencesSchema>;

function readStorage<T>(storage: Storage, key: string, schema: z.ZodMiniType<T>, fallback: T): T {
  const storedValue = storage.getItem(key);
  if (!storedValue) {
    return fallback;
  }

  try {
    return schema.parse(JSON.parse(storedValue));
  } catch {
    storage.removeItem(key);
    return fallback;
  }
}

export function readCachedSetup(): SetupStatus | null {
  return readStorage(window.sessionStorage, setupStorageKey, setupStatusSchema, null);
}

export function cacheSetup(setup: SetupStatus): void {
  window.sessionStorage.setItem(setupStorageKey, JSON.stringify(setup));
}

export function readSelectedRepositories(): string[] {
  return readStorage(window.localStorage, repositorySelectionKey, repositorySelectionSchema, []);
}

export function cacheSelectedRepositories(repositories: string[]): void {
  window.localStorage.setItem(repositorySelectionKey, JSON.stringify(repositories));
}

export function readPreferences(): ReviewPreferences | null {
  return readStorage(window.localStorage, preferencesKey, preferencesSchema, null);
}

export function savePreferences(preferences: ReviewPreferences): void {
  window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
}

export function isSetupComplete(): boolean {
  return window.localStorage.getItem(setupCompleteKey) === "true";
}

export function markSetupComplete(): void {
  window.localStorage.setItem(setupCompleteKey, "true");
}
