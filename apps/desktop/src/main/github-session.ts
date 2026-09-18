import { setTimeout as delay } from "node:timers/promises";
import type { GitHubSetupStatus } from "@review/contracts";
import { z } from "zod";
import { GitHubRejection, type GitHubRequest } from "./pull-request-github.js";
import type { GitHubCredentials, GitHubSessionStore, StoredGitHubSession } from "./github-session-store.js";

const deviceSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.url(),
  expires_in: z.number().positive(),
  interval: z.number().positive(),
});
const oauthErrorSchema = z.object({ error: z.string(), interval: z.number().positive().optional() });
const tokenSchema = z.union([
  z.object({ access_token: z.string().min(1), expires_in: z.number().positive(), refresh_token: z.string().min(1), refresh_token_expires_in: z.number().positive() }),
  z.object({ access_token: z.string().min(1), expires_in: z.undefined().optional(), refresh_token: z.undefined().optional() }),
]);
const userSchema = z.object({ id: z.number().int().positive(), login: z.string().min(1), avatar_url: z.string().nullable() });
const graphqlErrorsSchema = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) });

type SessionOptions = {
  clientId: string | undefined;
  store: GitHubSessionStore;
  fetch?: typeof fetch;
  authOrigin?: string;
  apiOrigin?: string;
  now?: () => number;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  onChange?: (status: GitHubSetupStatus) => void;
};

export type CapturedGitHubSession = {
  accountId: string;
  request: GitHubRequest;
  assertActive(): void;
};

export function createGitHubSession(options: SessionOptions) {
  const fetchRequest = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds, signal) => delay(milliseconds, undefined, { signal }));
  const authOrigin = options.authOrigin ?? "https://github.com";
  const apiOrigin = options.apiOrigin ?? "https://api.github.com";
  let current: StoredGitHubSession | null = null;
  let state: GitHubSetupStatus = options.clientId
    ? { state: "disconnected", message: null }
    : { state: "unavailable", message: "GitHub sign-in is not configured for this build." };
  let generation = 0;
  let controller = new AbortController();
  let initialization: Promise<void> | undefined;
  let refresh: Promise<GitHubCredentials> | undefined;
  let persistence = Promise.resolve();
  let captured: CapturedGitHubSession | undefined;

  function publish(next: GitHubSetupStatus) {
    state = next;
    options.onChange?.(next);
  }

  function persist(operation: () => Promise<void>) {
    const result = persistence.then(operation);
    persistence = result.catch(() => {});
    return result;
  }

  function invalidate() {
    generation += 1;
    controller.abort();
    controller = new AbortController();
    current = null;
    refresh = undefined;
    captured = undefined;
  }

  function assertGeneration(expected: number) {
    if (expected !== generation) throw new Error("The GitHub session changed. Try again.");
  }

  async function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      if (!options.clientId) return;
      try {
        const stored = await options.store.read();
        if (stored?.clientId === options.clientId) {
          current = stored;
          publish({ state: "connected", account: stored.account });
        }
      } catch {
        publish({ state: "disconnected", message: "Unable to open secure GitHub credentials. Unlock your system keychain and sign in again." });
      }
    })();
    return initialization;
  }

  async function status(): Promise<GitHubSetupStatus> {
    await initialize();
    return state;
  }

  async function disconnect(message: string | null) {
    invalidate();
    const expected = generation;
    publish({ state: "disconnected", message });
    try {
      await persist(() => options.store.clear());
    } catch {
      const failure = "GitHub is disconnected, but saved credentials could not be removed. This account may reconnect when Review restarts.";
      if (expected === generation) publish({ state: "disconnected", message: failure });
      throw new Error(failure);
    }
  }

  async function oauth(path: string, body: URLSearchParams, signal: AbortSignal) {
    const response = await fetchRequest(`${authOrigin}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      redirect: "error",
    });
    const result: unknown = await response.json();
    if (!response.ok && !oauthErrorSchema.safeParse(result).success) throw new Error(`GitHub sign-in failed (${response.status}). Try again.`);
    return result;
  }

  function credentials(token: z.infer<typeof tokenSchema>): GitHubCredentials {
    if (token.expires_in !== undefined) return {
      kind: "expiring",
      accessToken: token.access_token,
      accessExpiresAt: now() + token.expires_in * 1000,
      refreshToken: token.refresh_token,
      refreshExpiresAt: now() + token.refresh_token_expires_in * 1000,
    };
    return { kind: "non-expiring", accessToken: token.access_token };
  }

  async function poll(device: z.infer<typeof deviceSchema>, expected: number, signal: AbortSignal, expiresAt: number, clientId: string) {
    let interval = device.interval * 1000;
    try {
      while (now() < expiresAt) {
        await sleep(Math.min(interval, expiresAt - now()), signal);
        assertGeneration(expected);
        if (now() >= expiresAt) break;
        const result = await oauth("/login/oauth/access_token", new URLSearchParams({ client_id: clientId, device_code: device.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }), signal);
        assertGeneration(expected);
        const error = oauthErrorSchema.safeParse(result);
        if (error.success) {
          if (error.data.error === "authorization_pending") continue;
          if (error.data.error === "slow_down") {
            interval = Math.max(interval + 5000, (error.data.interval ?? 0) * 1000);
            continue;
          }
          if (error.data.error === "access_denied") throw new Error("GitHub sign-in was declined. Try again when ready.");
          if (["expired_token", "token_expired"].includes(error.data.error)) break;
          throw new Error("GitHub could not complete sign-in. Check the app configuration and try again.");
        }
        const nextCredentials = credentials(tokenSchema.parse(result));
        const response = await fetchRequest(`${apiOrigin}/user`, { headers: { authorization: `Bearer ${nextCredentials.accessToken}`, accept: "application/vnd.github+json" }, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]), redirect: "error" });
        if (!response.ok) throw new Error("Unable to verify the GitHub account. Try signing in again.");
        const user = userSchema.parse(await response.json());
        assertGeneration(expected);
        const session: StoredGitHubSession = { version: 1, clientId, account: { id: String(user.id), login: user.login, avatarUrl: user.avatar_url }, credentials: nextCredentials };
        await persist(async () => {
          assertGeneration(expected);
          await options.store.write(session);
        });
        assertGeneration(expected);
        current = session;
        publish({ state: "connected", account: session.account });
        return;
      }
      if (expected === generation) await disconnect("The GitHub sign-in code expired. Try again.");
    } catch (error) {
      if (expected !== generation) return;
      await disconnect(error instanceof Error && !(error instanceof z.ZodError) ? error.message : "GitHub returned an invalid sign-in response. Try again.");
    }
  }

  async function signIn(): Promise<GitHubSetupStatus> {
    await initialize();
    const clientId = options.clientId;
    if (!clientId) return state;
    invalidate();
    publish({ state: "disconnected", message: null });
    const expected = generation;
    const signal = controller.signal;
    try {
      await persist(() => options.store.clear());
      assertGeneration(expected);
      const device = deviceSchema.parse(await oauth("/login/device/code", new URLSearchParams({ client_id: clientId }), signal));
      assertGeneration(expected);
      const uri = new URL(device.verification_uri);
      if (uri.origin !== "https://github.com" || uri.pathname !== "/login/device" || uri.search || uri.hash || uri.username || uri.password) throw new Error("GitHub returned an invalid verification address.");
      const expiresAt = now() + device.expires_in * 1000;
      publish({ state: "authorizing", userCode: device.user_code, verificationUri: uri.href, expiresAt: new Date(expiresAt).toISOString() });
      void poll(device, expected, signal, expiresAt, clientId).catch(() => {
        if (expected === generation) publish({ state: "disconnected", message: "Unable to save GitHub sign-in. Try again." });
      });
    } catch (error) {
      if (expected === generation) publish({ state: "disconnected", message: error instanceof Error && !(error instanceof z.ZodError) ? error.message : "Unable to start GitHub sign-in. Try again." });
    }
    return state;
  }

  async function cancel() {
    await initialize();
    if (!current) await disconnect(null);
  }

  async function signOut() {
    await initialize();
    await disconnect(null);
  }

  async function accessToken(expected: number): Promise<string> {
    assertGeneration(expected);
    const session = current;
    if (!session) throw new GitHubRejection("Sign in to GitHub to continue.");
    const token = session.credentials;
    if (token.kind === "non-expiring" || token.accessExpiresAt > now() + 60_000) return token.accessToken;
    if (!refresh) {
      const operation = (async () => {
        if (token.kind !== "expiring" || token.refreshExpiresAt <= now()) {
          await disconnect("Your GitHub session expired. Sign in again.");
          throw new GitHubRejection("Your GitHub session expired. Sign in again.");
        }
        const response = await oauth("/login/oauth/access_token", new URLSearchParams({ client_id: session.clientId, grant_type: "refresh_token", refresh_token: token.refreshToken }), controller.signal);
        assertGeneration(expected);
        const error = oauthErrorSchema.safeParse(response);
        if (error.success) {
          if (["bad_refresh_token", "expired_token", "invalid_grant", "access_denied"].includes(error.data.error)) await disconnect("Your GitHub session expired. Sign in again.");
          throw new Error("Unable to refresh GitHub sign-in. Try again.");
        }
        const nextCredentials = credentials(tokenSchema.parse(response));
        const next = { ...session, credentials: nextCredentials };
        try {
          await persist(async () => {
            assertGeneration(expected);
            await options.store.write(next);
          });
        } catch {
          if (expected === generation) await disconnect("Unable to save renewed GitHub credentials. Sign in again.");
          throw new GitHubRejection("Unable to save renewed GitHub credentials. Sign in again.");
        }
        assertGeneration(expected);
        current = next;
        return nextCredentials;
      })();
      refresh = operation;
      void operation.finally(() => { if (refresh === operation) refresh = undefined; }).catch(() => {});
    }
    return (await refresh).accessToken;
  }

  async function rejectResponse(response: Response, expected: number, token: string): Promise<never> {
    if (response.status === 401 && refresh) {
      try {
        await refresh;
      } catch {
        throw new GitHubRejection("GitHub rejected this request. Check your sign-in and try again.");
      }
      assertGeneration(expected);
    }
    if (response.status === 401 && current?.credentials.accessToken === token) await disconnect("Your GitHub session is no longer valid. Sign in again.");
    if ([403, 429].includes(response.status)) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const wait = retryAfter > 0 ? Math.ceil(retryAfter) : reset > 0 ? Math.max(1, Math.ceil(reset - now() / 1000)) : null;
      if (wait !== null || response.headers.get("x-ratelimit-remaining") === "0" || response.status === 429) {
        throw new GitHubRejection(wait === null ? "GitHub request limit reached. Wait a minute and try again." : `GitHub request limit reached. Try again in ${wait} seconds.`);
      }
    }
    const message = `GitHub request failed (${response.status}).`;
    if ([400, 401, 403, 404, 405, 409, 422].includes(response.status)) throw new GitHubRejection(message);
    throw new Error(message);
  }

  async function capture(): Promise<CapturedGitHubSession> {
    await initialize();
    if (captured) return captured;
    const expected = generation;
    const session = current;
    const signal = controller.signal;
    if (!session) throw new GitHubRejection("Sign in to GitHub to continue.");
    const assertActive = () => assertGeneration(expected);
    const request: GitHubRequest = async (endpoint, body, method) => {
      const url = new URL(endpoint, `${apiOrigin}/`);
      if (url.origin !== new URL(apiOrigin).origin || url.username || url.password) throw new GitHubRejection("Invalid GitHub API address.");
      let token: string;
      try {
        token = await accessToken(expected);
        assertActive();
      } catch (error) {
        if (error instanceof GitHubRejection) throw error;
        throw new GitHubRejection("Unable to authenticate this request. Check your connection and GitHub sign-in, then try again.");
      }
      const init: RequestInit = {
        method: method ?? (body ? "POST" : "GET"),
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        redirect: "error",
      };
      if (body) init.body = JSON.stringify(body);
      const response = await fetchRequest(url, init);
      assertActive();
      if (!response.ok) return rejectResponse(response, expected, token);
      if (response.status === 204) return null;
      const result: unknown = await response.json();
      assertActive();
      if (url.pathname === "/graphql" && graphqlErrorsSchema.safeParse(result).success) throw new Error("GitHub could not complete the GraphQL request.");
      return result;
    };
    captured = { accountId: session.account.id, request, assertActive };
    return captured;
  }

  return { status, signIn, cancel, signOut, capture };
}
