import type {
  GitHubRepositoryChoice,
  PullRequestGroup,
  PullRequestReviewState,
  PullRequestStatus,
} from "@review/contracts";
import { z } from "zod";
import type { GitHubRequest } from "./pull-request-github.js";

const installationPageSchema = z.object({
  installations: z.array(z.object({ id: z.number().int().positive() })),
});
const repositoryPageSchema = z.object({
  repositories: z.array(z.object({
    full_name: z.string(),
    private: z.boolean(),
    archived: z.boolean(),
  })),
});

export async function readGitHubRepositories(github: GitHubRequest): Promise<GitHubRepositoryChoice[]> {
  const repositories = new Map<string, GitHubRepositoryChoice>();
  for (let page = 1; ; page += 1) {
    const { installations } = installationPageSchema.parse(await github(`user/installations?per_page=100&page=${page}`));
    for (const installation of installations) {
      for (let repositoryPage = 1; ; repositoryPage += 1) {
        const result = repositoryPageSchema.parse(await github(`user/installations/${installation.id}/repositories?per_page=100&page=${repositoryPage}`));
        for (const repository of result.repositories) {
          if (!repository.archived) {
            repositories.set(repository.full_name, {
              value: repository.full_name,
              label: repository.full_name,
              isPrivate: repository.private,
            });
          }
        }
        if (result.repositories.length < 100) break;
      }
    }
    if (installations.length < 100) break;
  }
  return [...repositories.values()].sort((left, right) => left.label.localeCompare(right.label));
}

const pullRequestSchema = z.object({
  additions: z.number().int().nonnegative(),
  author: z.object({ login: z.string(), avatarUrl: z.string().url() }).nullable(),
  baseRefName: z.string(),
  baseRefOid: z.string(),
  changedFiles: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  fullDatabaseId: z.union([z.string(), z.number().int().nonnegative()]).transform(String),
  headRefName: z.string(),
  headRefOid: z.string(),
  isDraft: z.boolean(),
  number: z.number().int().positive(),
  reviewDecision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]).nullable(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  title: z.string(),
  updatedAt: z.string(),
  url: z.string().url(),
});
const pullRequestListSchema = z.object({
  data: z.object({
    repository: z.object({ pullRequests: z.object({ nodes: z.array(pullRequestSchema) }) }),
  }),
});
type RemotePullRequest = z.infer<typeof pullRequestSchema>;

function reviewState(decision: RemotePullRequest["reviewDecision"]): PullRequestReviewState {
  switch (decision) {
    case "APPROVED": return "approved";
    case "CHANGES_REQUESTED": return "changesRequested";
    case "REVIEW_REQUIRED": return "reviewRequired";
    case null: return "none";
  }
}

function status(pr: RemotePullRequest): PullRequestStatus {
  if (pr.state === "MERGED") return "merged";
  if (pr.state === "CLOSED") return "closed";
  if (pr.isDraft) return "draft";
  if (pr.reviewDecision === "APPROVED") return "approved";
  if (pr.reviewDecision !== null) return "inReview";
  return "open";
}

export async function readPullRequestsFromGitHub(repository: string, github: GitHubRequest): Promise<PullRequestGroup> {
  const [owner, name] = repository.split("/");
  const response = await github("graphql", {
    query: `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequests(first:100,states:[OPEN,CLOSED,MERGED],orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title author{login avatarUrl} updatedAt additions deletions changedFiles isDraft url headRefName baseRefName headRefOid baseRefOid fullDatabaseId reviewDecision state}}}}`,
    variables: { owner, name },
  });
  const pullRequests = pullRequestListSchema.parse(response).data.repository.pullRequests.nodes;
  return {
    repository,
    state: "ready",
    pullRequests: pullRequests.map((pr) => ({
      repository,
      githubId: pr.fullDatabaseId,
      number: pr.number,
      title: pr.title,
      authorLogin: pr.author?.login ?? "ghost",
      authorAvatarUrl: pr.author?.avatarUrl ?? null,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      updatedAt: pr.updatedAt,
      isDraft: pr.isDraft,
      url: pr.url,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      baseSha: pr.baseRefOid,
      headSha: pr.headRefOid,
      reviewState: reviewState(pr.reviewDecision),
      status: status(pr),
    })),
  };
}
