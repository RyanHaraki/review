import {
  type ReviewPreferences,
  type SetupStatus,
} from "@review/contracts";
import { z } from "zod/mini";

const setupStorageKey = "review.setup-status";
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
let preferencesSaveQueue = Promise.resolve();

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

export async function readPreferences(): Promise<ReviewPreferences> {
  await preferencesSaveQueue.catch(() => undefined);
  return window.reviewDesktop.readPreferences();
}

export function savePreferences(preferences: ReviewPreferences): Promise<void> {
  const save = preferencesSaveQueue
    .catch(() => undefined)
    .then(() => window.reviewDesktop.savePreferences(preferences));
  preferencesSaveQueue = save;
  return save;
}
