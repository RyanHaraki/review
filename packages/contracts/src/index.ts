export type Repository = {
  id: string;
  githubId: number;
  owner: string;
  name: string;
  defaultBranch: string;
  fetchedAt: string;
};

export type PullRequest = {
  id: string;
  repositoryId: string;
  githubId: number;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  authorLogin: string;
  baseSha: string;
  headSha: string;
  fetchedAt: string;
};

export type PullRequestFile = {
  id: string;
  pullRequestId: string;
  path: string;
  status: "added" | "changed" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch: string | null;
};

export type ReviewRevision = {
  id: string;
  pullRequestId: string;
  headSha: string;
  status: "pending" | "generating" | "ready" | "failed";
  guideMarkdown: string | null;
  generatedAt: string | null;
};

export type ReviewThread = {
  id: string;
  reviewRevisionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  citationsJson: string;
  createdAt: string;
};

export type LocalServerHealth = {
  ok: true;
  databasePath: string;
};

export type SetupConnectionState = "connected" | "disconnected" | "unavailable";

export type GitHubSetupStatus = {
  state: SetupConnectionState;
  login: string | null;
};

export type CodexSetupAccount =
  | {
      type: "chatgpt";
      email: string | null;
      plan: string;
    }
  | { type: "apiKey" }
  | { type: "amazonBedrock" };

export type CodexSetupStatus = {
  state: SetupConnectionState;
  account: CodexSetupAccount | null;
};

export type SetupStatus = {
  github: GitHubSetupStatus;
  codex: CodexSetupStatus;
};

export type GitHubRepositoryChoice = {
  value: string;
  label: string;
  isPrivate: boolean;
};

export type PullRequestReviewState =
  | "approved"
  | "changesRequested"
  | "reviewRequired"
  | "none";

export type PullRequestStatus =
  | "draft"
  | "open"
  | "inReview"
  | "approved"
  | "merged"
  | "closed";

export const defaultPullRequestStatuses: PullRequestStatus[] = ["draft", "open"];

export type ReviewPreferences = {
  repositories: string[];
  pullRequestStatuses: PullRequestStatus[];
  setupComplete: boolean;
};

export type PullRequestSummary = {
  repository: string;
  githubId: string;
  number: number;
  title: string;
  authorLogin: string;
  authorAvatarUrl: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  updatedAt: string;
  isDraft: boolean;
  url: string;
  headRefName: string;
  baseRefName: string;
  baseSha: string;
  headSha: string;
  reviewState: PullRequestReviewState;
  status: PullRequestStatus;
};

export type PullRequestGroup = {
  repository: string;
  state: "ready" | "unavailable";
  pullRequests: PullRequestSummary[];
};

export type PullRequestCacheRead = {
  groups: PullRequestGroup[];
  freshRepositories: string[];
  cachedRepositories: string[];
};

export type PullRequestCacheWrite = {
  groups: PullRequestGroup[];
};

export type DesktopBridge = {
  getElectronVersion(): string;
  getPlatform(): string;
  getSetupStatus(): Promise<SetupStatus>;
  connectCodex(): Promise<void>;
  readPreferences(): Promise<ReviewPreferences>;
  savePreferences(preferences: ReviewPreferences): Promise<void>;
  listGitHubRepositories(): Promise<GitHubRepositoryChoice[]>;
  listPullRequests(repositories: string[]): Promise<PullRequestGroup[]>;
};
