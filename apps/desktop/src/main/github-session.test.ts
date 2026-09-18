import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { createGitHubSession } from "./github-session.js";
import type { GitHubSessionStore, StoredGitHubSession } from "./github-session-store.js";
import { GitHubRejection } from "./pull-request-github.js";

const saved: StoredGitHubSession = {
  version: 1,
  clientId: "review-test",
  account: { id: "42", login: "reviewer", avatarUrl: null },
  credentials: { kind: "expiring", accessToken: "access-old", accessExpiresAt: 100_000, refreshToken: "refresh-old", refreshExpiresAt: 1_000_000 },
};
const token = { access_token: "access-new", expires_in: 28_800, refresh_token: "refresh-new", refresh_token_expires_in: 15_897_600 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

async function settle(predicate: () => boolean) {
  for (let turn = 0; turn < 30 && !predicate(); turn += 1) await setImmediate();
  assert.ok(predicate());
}

function fixture(initial: StoredGitHubSession | null = null) {
  let stored = initial;
  let time = 0;
  const sleeps: { milliseconds: number; finish(): void }[] = [];
  const requests: { path: string; body: string; authorization: string | null }[] = [];
  const responses: Response[] = [];
  let custom: ((path: string, init?: RequestInit) => Promise<Response>) | undefined;
  const store: GitHubSessionStore = {
    read: async () => stored,
    write: async (value) => { stored = value; },
    clear: async () => { stored = null; },
  };
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    requests.push({ path, body: String(init?.body ?? ""), authorization: new Headers(init?.headers).get("authorization") });
    if (custom) return custom(path, init);
    if (path === "/login/device/code") return Response.json({ device_code: "device-private", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 });
    if (path === "/login/oauth/access_token") return responses.shift() ?? Response.json(token);
    if (path === "/user") return Response.json({ id: 42, login: "reviewer", avatar_url: null });
    return Response.json({ ok: true });
  };
  const manager = createGitHubSession({
    clientId: "review-test", store, fetch: fetcher, now: () => time,
    sleep: async (milliseconds, signal) => {
      const pending = deferred<void>();
      sleeps.push({ milliseconds, finish: () => { time += milliseconds; pending.resolve(); } });
      await Promise.race([pending.promise, new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
      })]);
    },
  });
  return {
    manager, store, sleeps, requests, responses,
    stored: () => stored,
    advance: (value: number) => { time = value; },
    respond: (value: typeof custom) => { custom = value; },
  };
}

test("device flow waits for the interval and persists before connecting", async () => {
  const f = fixture();
  const pending = await f.manager.signIn();
  assert.equal(pending.state, "authorizing");
  assert.equal(JSON.stringify(pending).includes("device-private"), false);
  assert.equal(f.requests.length, 1);
  assert.equal(f.sleeps[0]?.milliseconds, 5000);
  f.sleeps[0]?.finish();
  await settle(() => f.stored() !== null);
  assert.equal((await f.manager.status()).state, "connected");
  assert.equal(f.stored()?.account.id, "42");
  assert.equal(f.requests[1]?.body.includes("client_secret"), false);
});

test("pending and slowdown responses respect the new interval", async () => {
  const f = fixture();
  f.responses.push(Response.json({ error: "authorization_pending" }), Response.json({ error: "slow_down", interval: 10 }));
  await f.manager.signIn();
  f.sleeps[0]?.finish();
  await settle(() => f.sleeps.length === 2);
  assert.equal(f.sleeps[1]?.milliseconds, 5000);
  f.sleeps[1]?.finish();
  await settle(() => f.sleeps.length === 3);
  assert.equal(f.sleeps[2]?.milliseconds, 10_000);
  await f.manager.cancel();
});

test("cancel stops polling and ignores a token delivered after cancellation", async () => {
  const f = fixture();
  await f.manager.signIn();
  const response = deferred<Response>();
  f.respond(async () => response.promise);
  f.sleeps[0]?.finish();
  await settle(() => f.requests.length === 2);
  await f.manager.cancel();
  response.resolve(Response.json(token));
  await setImmediate();
  assert.deepEqual(await f.manager.status(), { state: "disconnected", message: null });
  assert.equal(f.stored(), null);
  assert.equal(f.requests.some((request) => request.path === "/user"), false);
});

test("denied and expired device flows terminate", async () => {
  for (const error of ["access_denied", "expired_token"]) {
    const f = fixture();
    f.responses.push(Response.json({ error }));
    await f.manager.signIn();
    f.sleeps[0]?.finish();
    await settle(() => f.requests.length === 2);
    await setImmediate();
    const status = await f.manager.status();
    assert.equal(status.state, "disconnected");
    assert.equal(f.sleeps.length, 1);
  }
});

test("device flow stops at local expiry without a final token request", async () => {
  const f = fixture();
  await f.manager.signIn();
  f.advance(900_000);
  f.sleeps[0]?.finish();
  await setImmediate();
  assert.equal((await f.manager.status()).state, "disconnected");
  assert.equal(f.requests.length, 1);
});

test("verification URLs cannot direct the user to an arbitrary host", async () => {
  const f = fixture();
  f.respond(async () => Response.json({ device_code: "private", user_code: "public", verification_uri: "https://example.com/login/device", expires_in: 900, interval: 5 }));
  assert.equal((await f.manager.signIn()).state, "disconnected");
  assert.equal(f.sleeps.length, 0);
});

test("a temporary credential-store read failure permits signing in again", async () => {
  const f = fixture();
  f.store.read = async () => { throw new Error("keychain locked"); };
  assert.equal((await f.manager.status()).state, "disconnected");
  assert.equal((await f.manager.signIn()).state, "authorizing");
  f.sleeps[0]?.finish();
  await settle(() => f.stored() !== null);
  assert.equal((await f.manager.status()).state, "connected");
});

test("stored credentials for another client ID are never used", async () => {
  const other = { ...saved, clientId: "another-app" };
  const f = fixture(other);
  assert.deepEqual(await f.manager.status(), { state: "disconnected", message: null });
  await assert.rejects(f.manager.capture(), /Sign in/);
  assert.equal(f.stored(), other);
  assert.equal(f.requests.length, 0);
});

test("a new sign-in attempt supersedes a pending device-code request", async () => {
  const f = fixture();
  const firstDevice = deferred<Response>();
  f.respond(async () => firstDevice.promise);
  const first = f.manager.signIn();
  await settle(() => f.requests.length === 1);
  f.respond(undefined);
  const second = await f.manager.signIn();
  firstDevice.resolve(Response.json({ device_code: "old-device", user_code: "OLD-CODE", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }));
  await first;
  assert.deepEqual(await f.manager.status(), second);
  assert.equal(f.sleeps.length, 1);
  await f.manager.cancel();
});

test("concurrent calls share refresh and use the persisted replacement", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  f.advance(100_000);
  await Promise.all([captured.request("repos/a/b"), captured.request("repos/c/d")]);
  assert.equal(f.requests.filter((request) => request.path === "/login/oauth/access_token").length, 1);
  assert.ok(f.requests.filter((request) => request.path.startsWith("/repos")).every((request) => request.authorization === "Bearer access-new"));
  assert.equal(f.stored()?.credentials.accessToken, "access-new");
  assert.equal(await f.manager.capture(), captured);
});

test("sign-out invalidates captured work and prevents late refresh persistence", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  const response = deferred<Response>();
  f.respond(async () => response.promise);
  f.advance(100_000);
  const request = captured.request("repos/a/b");
  const rejected = assert.rejects(request);
  await settle(() => f.requests.length === 1);
  await f.manager.signOut();
  response.resolve(Response.json(token));
  await rejected;
  assert.equal(f.stored(), null);
  assert.throws(captured.assertActive, /session changed/);
  await assert.rejects(f.manager.capture(), /Sign in/);
});

test("sign-out clears a rotated session even when persistence is already in progress", async () => {
  const f = fixture(saved);
  const originalWrite = f.store.write;
  const release = deferred<void>();
  let writing = false;
  f.store.write = async (value) => {
    writing = true;
    await release.promise;
    await originalWrite(value);
  };
  const captured = await f.manager.capture();
  f.advance(100_000);
  const rejected = assert.rejects(captured.request("user"));
  await settle(() => writing);
  const signOut = f.manager.signOut();
  await setImmediate();
  assert.equal((await f.manager.status()).state, "disconnected");
  release.resolve();
  await Promise.all([signOut, rejected]);
  assert.equal(f.stored(), null);
  assert.equal(f.requests.length, 1);
});

test("sign-out reports a credential deletion failure in observable status", async () => {
  const f = fixture(saved);
  await f.manager.status();
  f.store.clear = async () => { throw new Error("permission denied"); };
  await assert.rejects(f.manager.signOut(), /saved credentials could not be removed/);
  const status = await f.manager.status();
  assert.equal(status.state, "disconnected");
  assert.ok(status.state === "disconnected" && status.message?.includes("saved credentials could not be removed"));
  assert.equal(f.stored(), saved);
  await assert.rejects(f.manager.capture(), /Sign in/);
});

test("a late credential deletion failure cannot overwrite a new sign-in state", async () => {
  const f = fixture(saved);
  await f.manager.status();
  const release = deferred<void>();
  const originalClear = f.store.clear;
  let clearCount = 0;
  f.store.clear = async () => {
    clearCount += 1;
    if (clearCount === 1) {
      await release.promise;
      throw new Error("permission denied");
    }
    await originalClear();
  };
  const failedSignOut = assert.rejects(f.manager.signOut(), /saved credentials could not be removed/);
  await settle(() => clearCount === 1);
  const device = deferred<Response>();
  f.respond(async () => device.promise);
  const signIn = f.manager.signIn();
  await setImmediate();
  release.resolve();
  await failedSignOut;
  await settle(() => f.requests.length === 1);
  assert.deepEqual(await f.manager.status(), { state: "disconnected", message: null });
  device.resolve(Response.json({ device_code: "new-device", user_code: "NEW-CODE", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }));
  assert.equal((await signIn).state, "authorizing");
  await f.manager.cancel();
});

test("failed storage after refresh does not reuse invalidated credentials", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  f.advance(100_000);
  f.store.write = async () => { throw new Error("disk full"); };
  await assert.rejects(captured.request("user"), /Unable to save renewed/);
  assert.equal(f.stored(), null);
  assert.equal((await f.manager.status()).state, "disconnected");
  assert.equal(f.requests.length, 1);
});

test("a delayed old-token 401 waits for an ongoing refresh", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  const oldResponse = deferred<Response>();
  const refreshResponse = deferred<Response>();
  f.respond(async (path) => {
    if (path === "/old") return oldResponse.promise;
    if (path === "/login/oauth/access_token") return refreshResponse.promise;
    return Response.json({ ok: true });
  });
  const rejected = assert.rejects(captured.request("old"), GitHubRejection);
  await settle(() => f.requests.length === 1);
  f.advance(100_000);
  const newer = captured.request("new");
  await settle(() => f.requests.length === 2);
  oldResponse.resolve(new Response(null, { status: 401 }));
  await setImmediate();
  refreshResponse.resolve(Response.json(token));
  await Promise.all([newer, rejected]);
  assert.equal(f.stored()?.credentials.accessToken, "access-new");
  assert.equal((await f.manager.status()).state, "connected");
});

test("revoked refresh clears session but a network failure preserves it", async () => {
  const revoked = fixture(saved);
  const captured = await revoked.manager.capture();
  revoked.advance(100_000);
  revoked.responses.push(Response.json({ error: "bad_refresh_token" }));
  await assert.rejects(captured.request("user"));
  assert.equal(revoked.stored(), null);

  const offline = fixture(saved);
  const active = await offline.manager.capture();
  offline.advance(100_000);
  offline.respond(async () => { throw new Error("offline"); });
  await assert.rejects(active.request("user"), GitHubRejection);
  assert.equal(offline.stored(), saved);
  assert.equal((await offline.manager.status()).state, "connected");
});

test("401 disconnects without replaying a write", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  f.respond(async () => new Response(null, { status: 401 }));
  await assert.rejects(captured.request("repos/a/b/issues/1/comments", { body: "hello" }), GitHubRejection);
  assert.equal(f.requests.length, 1);
  assert.equal(f.stored(), null);
});

test("a delayed 401 for the old access token does not clear its replacement", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  const oldResponse = deferred<Response>();
  f.respond(async (path) => {
    if (path === "/old") return oldResponse.promise;
    if (path === "/login/oauth/access_token") return Response.json(token);
    return Response.json({ ok: true });
  });
  const old = captured.request("old");
  const rejected = assert.rejects(old, GitHubRejection);
  await settle(() => f.requests.length === 1);
  f.advance(100_000);
  await captured.request("new");
  oldResponse.resolve(new Response(null, { status: 401 }));
  await rejected;
  assert.equal(f.stored()?.credentials.accessToken, "access-new");
  assert.equal((await f.manager.status()).state, "connected");
});

test("GraphQL errors and transport failures do not replay mutations", async () => {
  const f = fixture(saved);
  const captured = await f.manager.capture();
  f.respond(async () => Response.json({ errors: [{ message: "failure" }], data: null }));
  await assert.rejects(captured.request("graphql", { query: "mutation{}" }), /GraphQL/);
  assert.equal(f.requests.length, 1);
  f.respond(async () => { throw new Error("connection reset"); });
  await assert.rejects(captured.request("repos/a/b", { body: "hello" }), /connection reset/);
  assert.equal(f.requests.length, 2);
});

test("captured client rejects off-origin endpoints before sending credentials", async () => {
  const f = fixture(saved);
  await assert.rejects((await f.manager.capture()).request("https://example.com/steal"), GitHubRejection);
  assert.equal(f.requests.length, 0);
});

test("requests disable redirects and return safe rate-limit instructions", async () => {
  const f = fixture(saved);
  f.respond(async (_path, init) => {
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json({ message: "private server details" }, { status: 403, headers: { "retry-after": "30" } });
  });
  await assert.rejects((await f.manager.capture()).request("user"), /Try again in 30 seconds/);
  assert.equal((await f.manager.status()).state, "connected");
});

test("a new login for the same account creates a new captured session", async () => {
  const f = fixture(saved);
  const old = await f.manager.capture();
  await f.manager.signOut();
  await f.manager.signIn();
  f.sleeps[0]?.finish();
  await settle(() => f.stored() !== null);
  const current = await f.manager.capture();
  assert.equal(current.accountId, old.accountId);
  assert.notEqual(current, old);
  assert.throws(old.assertActive);
});
