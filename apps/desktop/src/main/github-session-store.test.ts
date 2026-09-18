import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGitHubSessionStore, type StoredGitHubSession } from "./github-session-store.js";

const session: StoredGitHubSession = {
  version: 1, clientId: "client", account: { id: "42", login: "reviewer", avatarUrl: null },
  credentials: { kind: "non-expiring", accessToken: "sensitive-access-token" },
};

function encryption() {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(value: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(value: Buffer) {
      const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
    },
  };
}

test("stores an encrypted session with restrictive permissions and no temporary files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-session-"));
  const path = join(directory, "github-session.enc");
  try {
    const store = createGitHubSessionStore({ path, encryption: encryption() });
    assert.equal(await store.read(), null);
    await store.write(session);
    assert.deepEqual(await store.read(), session);
    assert.equal((await readFile(path)).includes(Buffer.from("sensitive-access-token")), false);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(directory), ["github-session.enc"]);
    await store.clear();
    await store.clear();
    assert.equal(await store.read(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects missing keychain and the plaintext Linux backend", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-session-unavailable-"));
  try {
    for (const provider of [
      { ...encryption(), isEncryptionAvailable: () => false },
      { ...encryption(), getSelectedStorageBackend: () => "basic_text" },
    ]) {
      const store = createGitHubSessionStore({ path: join(directory, "session"), encryption: provider });
      await assert.rejects(store.read(), /Secure credential/);
      await assert.rejects(store.write(session), /Secure credential/);
    }
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed encryption leaves the prior session intact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-session-failure-"));
  try {
    const provider = encryption();
    const path = join(directory, "session");
    const store = createGitHubSessionStore({ path, encryption: provider });
    await store.write(session);
    const broken = createGitHubSessionStore({ path, encryption: { ...provider, encryptString: () => { throw new Error("keychain locked"); } } });
    await assert.rejects(broken.write(session), /keychain locked/);
    assert.deepEqual(await store.read(), session);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
