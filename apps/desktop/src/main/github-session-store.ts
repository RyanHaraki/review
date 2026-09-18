import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { githubAccountSchema } from "@review/contracts";
import { z } from "zod";

export const githubCredentialsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("expiring"),
    accessToken: z.string().min(1),
    accessExpiresAt: z.number(),
    refreshToken: z.string().min(1),
    refreshExpiresAt: z.number(),
  }),
  z.object({ kind: z.literal("non-expiring"), accessToken: z.string().min(1) }),
]);

export const storedGitHubSessionSchema = z.object({
  version: z.literal(1),
  clientId: z.string().min(1),
  account: githubAccountSchema,
  credentials: githubCredentialsSchema,
});

export type GitHubCredentials = z.infer<typeof githubCredentialsSchema>;
export type StoredGitHubSession = z.infer<typeof storedGitHubSessionSchema>;
export type GitHubSessionStore = {
  read(): Promise<StoredGitHubSession | null>;
  write(session: StoredGitHubSession): Promise<void>;
  clear(): Promise<void>;
};

type Encryption = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
  getSelectedStorageBackend?(): string;
};

export function createGitHubSessionStore({ path, encryption }: { path: string; encryption: Encryption }): GitHubSessionStore {
  function requireEncryption() {
    if (!encryption.isEncryptionAvailable() || encryption.getSelectedStorageBackend?.() === "basic_text") {
      throw new Error("Secure credential storage is unavailable. Unlock your system keychain and try again.");
    }
  }

  return {
    async read() {
      requireEncryption();
      let buffer: Buffer;
      try {
        buffer = await readFile(path);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }
      return storedGitHubSessionSchema.parse(JSON.parse(encryption.decryptString(buffer)));
    },
    async write(session) {
      requireEncryption();
      const encrypted = encryption.encryptString(JSON.stringify(storedGitHubSessionSchema.parse(session)));
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, encrypted, { mode: 0o600, flag: "wx", flush: true });
        await rename(temporaryPath, path);
      } finally {
        await rm(temporaryPath, { force: true });
      }
    },
    async clear() {
      await rm(path, { force: true });
    },
  };
}
