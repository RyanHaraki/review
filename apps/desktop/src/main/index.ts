import { join } from "node:path";
import { CodexAppServerClient } from "@review/codex-app-server";
import { defaultPullRequestStatuses, githubProfileSchema, type CodexSetupStatus, type PullRequestCacheRead, type PullRequestGroup, type ReviewPreferences } from "@review/contracts";
import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import { z } from "zod";
import { createGitHubSession } from "./github-session.js";
import { createGitHubSessionStore } from "./github-session-store.js";
import { createGitHubOperations, type GitHubOperation } from "./github-context.js";
import { readGitHubRepositories, readPullRequestsFromGitHub } from "./github-repositories.js";
import { registerPullRequestDetails } from "./pull-request-details.js";
import { createReviewGuides } from "./review-guide.js";
import type { GitHubRequest } from "./pull-request-github.js";

const codexClient = new CodexAppServerClient();
const localServerOrigin = process.env.REVIEW_SERVER_ORIGIN ?? "http://127.0.0.1:4319";
const repositoryListSchema = z.array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)).max(50);

function developmentOrigin(value: string | undefined): string | undefined {
  if (app.isPackaged || !value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/" || url.username || url.password) {
    throw new Error("GitHub test endpoints must use a loopback HTTP origin.");
  }
  return url.origin;
}

async function readPullRequestCache(origin: string, repositories: string[]): Promise<PullRequestCacheRead | null> {
  try {
    const response = await fetch(`${origin}/pull-requests/cache/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories }),
    });
    if (!response.ok) {
      return null;
    }
    // SAFETY: The local server creates this response from the shared PullRequestCacheRead contract.
    return await response.json() as PullRequestCacheRead;
  } catch {
    return null;
  }
}

async function writePullRequestCache(origin: string, groups: PullRequestGroup[]): Promise<void> {
  try {
    await fetch(`${origin}/pull-requests/cache`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groups }),
    });
  } catch {
    // The list can still use the GitHub result when the local cache is unavailable.
  }
}

async function readPreferences(origin: string): Promise<ReviewPreferences> {
  const response = await fetch(`${origin}/preferences`);
  if (!response.ok) {
    throw new Error("Unable to read preferences.");
  }
  // SAFETY: The local server validates and creates this response from ReviewPreferences.
  return await response.json() as ReviewPreferences;
}

async function savePreferences(origin: string, preferences: ReviewPreferences): Promise<void> {
  const response = await fetch(`${origin}/preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) {
    throw new Error("Unable to save preferences.");
  }
}

async function listPullRequests(context: GitHubOperation, repositoryInput: string[]): Promise<PullRequestGroup[]> {
  const { origin, request } = context;
  const repositories = repositoryListSchema.parse(repositoryInput);
  const cache = await readPullRequestCache(origin, repositories);
  const freshRepositories = new Set(cache?.freshRepositories ?? []);
  const cachedRepositories = new Set(cache?.cachedRepositories ?? []);
  const cachedGroups = new Map(cache?.groups.map((group) => [group.repository, group]) ?? []);
  const staleRepositories = repositories.filter((repository) => !freshRepositories.has(repository));
  const fetchedResults = await Promise.allSettled(staleRepositories.map((repository) => readPullRequestsFromGitHub(repository, request)));
  const fetchedGroups = new Map<string, PullRequestGroup>();

  for (const [index, result] of fetchedResults.entries()) {
    const repository = staleRepositories[index];
    if (!repository) {
      continue;
    }
    if (result.status === "fulfilled") {
      fetchedGroups.set(repository, result.value);
      continue;
    }
    if (!cachedRepositories.has(repository)) {
      fetchedGroups.set(repository, { repository, state: "unavailable", pullRequests: [] });
    }
  }

  const updatedGroups = [...fetchedGroups.values()].filter((group) => group.state === "ready");
  if (updatedGroups.length > 0) {
    await writePullRequestCache(origin, updatedGroups);
  }

  return repositories.map((repository) =>
    fetchedGroups.get(repository)
      ?? cachedGroups.get(repository)
      ?? { repository, state: "unavailable", pullRequests: [] },
  );
}

async function readCodexStatus(): Promise<CodexSetupStatus> {
  try {
    const status = await codexClient.readAccount();
    const account = status.account;

    if (!account) {
      return {
        state: "disconnected",
        account: null,
      };
    }

    if (account.type === "chatgpt") {
      return {
        state: "connected",
        account: {
          type: account.type,
          email: account.email,
          plan: account.planType,
        },
      };
    }

    if (account.type === "apiKey") {
      return {
        state: "connected",
        account: { type: account.type },
      };
    }

    return {
      state: "connected",
      account: { type: account.type },
    };
  } catch {
    return {
      state: "unavailable",
      account: null,
    };
  }
}

function registerGitHub() {
  const authOrigin = developmentOrigin(process.env.REVIEW_GITHUB_AUTH_ORIGIN);
  const apiOrigin = developmentOrigin(process.env.REVIEW_GITHUB_API_ORIGIN);
  const auth = createGitHubSession({
    clientId: process.env.REVIEW_GITHUB_CLIENT_ID ?? "Iv23liyi7SNFWnkOxQX6",
    authOrigin: authOrigin ?? "https://github.com",
    apiOrigin: apiOrigin ?? "https://api.github.com",
    store: createGitHubSessionStore({ path: join(app.getPath("userData"), "github-session.enc"), encryption: safeStorage }),
    onChange(status) {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send("github:changed", status);
    },
  });
  const withSession = createGitHubOperations(auth, localServerOrigin);
  const guides = new WeakMap<GitHubRequest, ReturnType<typeof createReviewGuides>>();
  function reviewGuides(context: GitHubOperation) {
    let manager = guides.get(context.request);
    if (!manager) {
      manager = createReviewGuides(context.origin, codexClient, context.request);
      guides.set(context.request, manager);
    }
    return manager;
  }
  registerPullRequestDetails(withSession);
  ipcMain.handle("github:session", () => auth.status());
  ipcMain.handle("github:profile", () => withSession(async ({ request }) => githubProfileSchema.parse(await request("user"))));
  ipcMain.handle("github:sign-in", async () => {
    const status = await auth.signIn();
    if (status.state === "authorizing" && !authOrigin) await shell.openExternal(status.verificationUri);
    return status;
  });
  ipcMain.handle("github:cancel", () => auth.cancel());
  ipcMain.handle("github:sign-out", () => auth.signOut());
  ipcMain.handle("github:install", () => shell.openExternal("https://github.com/apps/diligent-review/installations/new"));
  ipcMain.handle("setup:read", async () => {
    const [github, codex] = await Promise.all([auth.status(), readCodexStatus()]);
    return { github, codex };
  });
  ipcMain.handle("review-guide:read", (_event, key) => withSession((context) => reviewGuides(context).read(key)));
  ipcMain.handle("review-guide:generate", (_event, key) => withSession((context) => reviewGuides(context).ensure(key)));
  ipcMain.handle("setup:list-github-repositories", () => withSession(({ request }) => readGitHubRepositories(request)));
  ipcMain.handle("preferences:read", async () => {
    const status = await auth.status();
    if (status.state !== "connected") return { repositories: [], pullRequestStatuses: [...defaultPullRequestStatuses], setupComplete: false };
    return withSession(({ origin }) => readPreferences(origin));
  });
  ipcMain.handle("preferences:save", (_event, preferences: ReviewPreferences) => withSession(({ origin }) => savePreferences(origin, preferences)));
  ipcMain.handle("pull-requests:list", (_event, repositories: string[]) => withSession((context) => listPullRequests(context, repositories)));
  ipcMain.handle("setup:connect-codex", async () => {
    const login = await codexClient.startChatGptLogin();
    const authUrl = new URL(login.authUrl);
    const isChatGptHost = authUrl.hostname === "chatgpt.com" || authUrl.hostname.endsWith(".chatgpt.com");
    if (authUrl.protocol !== "https:" || (!isChatGptHost && authUrl.hostname !== "auth.openai.com")) throw new Error("Codex returned an unexpected sign-in URL.");
    await shell.openExternal(authUrl.toString());
  });
  app.on("before-quit", () => { void auth.cancel(); });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    show: false,
    backgroundColor: "#f9fafa",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerGitHub();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => codexClient.stop());
