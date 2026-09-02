import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import { CodexAppServerClient } from "@review/codex-app-server";
import type {
  CodexSetupStatus,
  GitHubRepositoryChoice,
  GitHubSetupStatus,
  PullRequestCacheRead,
  PullRequestGroup,
  PullRequestReviewState,
  PullRequestSummary,
  SetupStatus,
} from "@review/contracts";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const codexClient = new CodexAppServerClient();
let repositoryChoicesPromise: Promise<GitHubRepositoryChoice[]> | null = null;
const localServerOrigin = "http://127.0.0.1:4319";
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const repositoryListSchema = z.array(z.string().regex(repositoryPattern)).max(50);
const githubPullRequestSchema = z.object({
  additions: z.number().int().nonnegative(),
  author: z.object({ login: z.string() }),
  baseRefOid: z.string(),
  deletions: z.number().int().nonnegative(),
  fullDatabaseId: z.string(),
  headRefName: z.string(),
  headRefOid: z.string(),
  isDraft: z.boolean(),
  number: z.number().int().positive(),
  reviewDecision: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  url: z.string().url(),
});
const githubPullRequestListSchema = z.array(githubPullRequestSchema);

function normalizeReviewState(reviewDecision: string): PullRequestReviewState {
  if (reviewDecision === "APPROVED") {
    return "approved";
  }
  if (reviewDecision === "CHANGES_REQUESTED") {
    return "changesRequested";
  }
  if (reviewDecision === "REVIEW_REQUIRED") {
    return "reviewRequired";
  }
  return "none";
}

async function readPullRequestsFromGitHub(repository: string): Promise<PullRequestGroup> {
  const result = await execFileAsync(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,title,author,updatedAt,additions,deletions,isDraft,url,headRefName,headRefOid,baseRefOid,fullDatabaseId,reviewDecision",
    ],
    { maxBuffer: 10_000_000 },
  );
  const pullRequests = githubPullRequestListSchema.parse(JSON.parse(result.stdout));

  return {
    repository,
    state: "ready",
    pullRequests: pullRequests.map((pullRequest): PullRequestSummary => ({
      repository,
      githubId: pullRequest.fullDatabaseId,
      number: pullRequest.number,
      title: pullRequest.title,
      authorLogin: pullRequest.author.login,
      authorAvatarUrl: `https://avatars.githubusercontent.com/${encodeURIComponent(pullRequest.author.login)}?size=64`,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      updatedAt: pullRequest.updatedAt,
      isDraft: pullRequest.isDraft,
      url: pullRequest.url,
      headRefName: pullRequest.headRefName,
      baseSha: pullRequest.baseRefOid,
      headSha: pullRequest.headRefOid,
      reviewState: normalizeReviewState(pullRequest.reviewDecision),
    })),
  };
}

async function readPullRequestCache(repositories: string[]): Promise<PullRequestCacheRead | null> {
  try {
    const response = await fetch(`${localServerOrigin}/pull-requests/cache/read`, {
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

async function writePullRequestCache(groups: PullRequestGroup[]): Promise<void> {
  try {
    await fetch(`${localServerOrigin}/pull-requests/cache`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groups }),
    });
  } catch {
    // The list can still use the GitHub result when the local cache is unavailable.
  }
}

async function listPullRequests(repositoryInput: string[]): Promise<PullRequestGroup[]> {
  const repositories = repositoryListSchema.parse(repositoryInput);
  const cache = await readPullRequestCache(repositories);
  const freshRepositories = new Set(cache?.freshRepositories ?? []);
  const cachedRepositories = new Set(cache?.cachedRepositories ?? []);
  const cachedGroups = new Map(cache?.groups.map((group) => [group.repository, group]) ?? []);
  const staleRepositories = repositories.filter((repository) => !freshRepositories.has(repository));
  const fetchedResults = await Promise.allSettled(staleRepositories.map(readPullRequestsFromGitHub));
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
    await writePullRequestCache(updatedGroups);
  }

  return repositories.map((repository) =>
    fetchedGroups.get(repository)
      ?? cachedGroups.get(repository)
      ?? { repository, state: "unavailable", pullRequests: [] },
  );
}

function parseRepositoryChoice(line: string): GitHubRepositoryChoice | null {
  const [nameWithOwner, privateValue] = line.split("\t");
  if (!nameWithOwner?.includes("/")) {
    return null;
  }

  return {
    value: nameWithOwner,
    label: nameWithOwner,
    isPrivate: privateValue === "true",
  };
}

async function readGitHubRepositories(): Promise<GitHubRepositoryChoice[]> {
  const result = await execFileAsync(
    "gh",
    [
      "api",
      "--method",
      "GET",
      "/user/repos",
      "-f",
      "per_page=100",
      "-f",
      "sort=updated",
      "-f",
      "affiliation=owner,collaborator,organization_member",
      "--paginate",
      "--cache",
      "1h",
      "--jq",
      ".[] | select(.archived | not) | [.full_name, .private] | @tsv",
    ],
    { maxBuffer: 5_000_000 },
  );

  return result.stdout
    .split("\n")
    .map(parseRepositoryChoice)
    .filter((repository): repository is GitHubRepositoryChoice => repository !== null);
}

function listGitHubRepositories(): Promise<GitHubRepositoryChoice[]> {
  repositoryChoicesPromise ??= readGitHubRepositories().catch(() => {
    repositoryChoicesPromise = null;
    throw new Error("Unable to load GitHub repositories.");
  });

  return repositoryChoicesPromise;
}

async function readGitHubStatus(): Promise<GitHubSetupStatus> {
  try {
    await execFileAsync("gh", ["--version"]);
  } catch {
    return {
      state: "unavailable",
      login: null,
    };
  }

  try {
    await execFileAsync("gh", ["auth", "status", "--hostname", "github.com"]);
    const account = await execFileAsync("gh", ["api", "user", "--jq", ".login"]);
    const login = account.stdout.trim();

    return {
      state: "connected",
      login: login || null,
    };
  } catch {
    return {
      state: "disconnected",
      login: null,
    };
  }
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

async function readSetupStatus(): Promise<SetupStatus> {
  const [github, codex] = await Promise.all([readGitHubStatus(), readCodexStatus()]);

  return {
    github,
    codex,
  };
}

ipcMain.handle("setup:read", readSetupStatus);
ipcMain.handle("setup:list-github-repositories", listGitHubRepositories);
ipcMain.handle("setup:connect-codex", async () => {
  const login = await codexClient.startChatGptLogin();
  const authUrl = new URL(login.authUrl);
  const isChatGptHost = authUrl.hostname === "chatgpt.com" || authUrl.hostname.endsWith(".chatgpt.com");
  const isOpenAiAuthHost = authUrl.hostname === "auth.openai.com";

  if (authUrl.protocol !== "https:" || (!isChatGptHost && !isOpenAiAuthHost)) {
    throw new Error("Codex returned an unexpected sign-in URL.");
  }

  await shell.openExternal(authUrl.toString());
});
ipcMain.handle("pull-requests:list", (_event, repositories: string[]) =>
  listPullRequests(repositories));

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    show: false,
    backgroundColor: "#f7f7f5",
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
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => codexClient.stop());
