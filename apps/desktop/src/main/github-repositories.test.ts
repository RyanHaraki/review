import assert from "node:assert/strict";
import test from "node:test";
import { readGitHubRepositories, readPullRequestsFromGitHub } from "./github-repositories.js";
import type { GitHubRequest } from "./pull-request-github.js";

test("repository discovery paginates installations and repositories, excluding archived duplicates", async () => {
  const calls: string[] = [];
  const repository = { full_name: "team/review", private: true, archived: false };
  const github: GitHubRequest = async (endpoint) => {
    calls.push(endpoint);
    if (endpoint === "user/installations?per_page=100&page=1") {
      return { installations: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) };
    }
    if (endpoint === "user/installations?per_page=100&page=2") {
      return { installations: [{ id: 101 }] };
    }
    if (endpoint === "user/installations/1/repositories?per_page=100&page=1") {
      return { repositories: Array.from({ length: 100 }, (_, index) => ({
        ...repository, full_name: `team/archived-${index}`, archived: true,
      })) };
    }
    if (endpoint === "user/installations/1/repositories?per_page=100&page=2"
      || endpoint === "user/installations/101/repositories?per_page=100&page=1") {
      return { repositories: [repository] };
    }
    if (/^user\/installations\/\d+\/repositories\?per_page=100&page=1$/.test(endpoint)) {
      return { repositories: [] };
    }
    throw new Error(`Unexpected request ${endpoint}`);
  };
  assert.deepEqual(await readGitHubRepositories(github), [
    { value: "team/review", label: "team/review", isPrivate: true },
  ]);
  assert.ok(calls.includes("user/installations?per_page=100&page=2"));
  assert.ok(calls.includes("user/installations/1/repositories?per_page=100&page=2"));
  assert.ok(calls.includes("user/installations/101/repositories?per_page=100&page=1"));
});

test("repository discovery rejects malformed permissions data instead of treating it as an empty account", async () => {
  await assert.rejects(readGitHubRepositories(async () => ({ installations: null })));
  await assert.rejects(readGitHubRepositories(async (endpoint) => endpoint.startsWith("user/installations?")
    ? { installations: [{ id: 1 }] }
    : { repositories: [{ full_name: "team/review", private: "false", archived: false }] }));
});

const pullRequest = {
  number: 11,
  title: "A change",
  author: { login: "reviewer", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
  updatedAt: "2026-09-18T00:00:00Z",
  additions: 4,
  deletions: 2,
  changedFiles: 1,
  isDraft: false,
  url: "https://github.com/team/review/pull/11",
  headRefName: "feature",
  baseRefName: "main",
  headRefOid: "head",
  baseRefOid: "base",
  fullDatabaseId: "9007199254740993",
  reviewDecision: null,
  state: "OPEN",
};

test("PR summaries retain revision IDs and normalize missing actors and review decisions", async () => {
  const github: GitHubRequest = async (endpoint, body) => {
    assert.equal(endpoint, "graphql");
    assert.deepEqual(body?.variables, { owner: "team", name: "review" });
    assert.match(String(body?.query), /first:100,states:\[OPEN,CLOSED,MERGED\],orderBy:\{field:UPDATED_AT,direction:DESC\}/);
    return { data: { repository: { pullRequests: { nodes: [
      { ...pullRequest, author: null },
      { ...pullRequest, number: 12, reviewDecision: "APPROVED" },
      { ...pullRequest, number: 13, isDraft: true, reviewDecision: "APPROVED" },
      { ...pullRequest, number: 14, reviewDecision: "CHANGES_REQUESTED" },
      { ...pullRequest, number: 15, reviewDecision: "REVIEW_REQUIRED" },
      { ...pullRequest, number: 16, state: "CLOSED", isDraft: true },
      { ...pullRequest, number: 17, state: "MERGED", reviewDecision: "APPROVED" },
    ] } } } };
  };
  const result = await readPullRequestsFromGitHub("team/review", github);
  assert.equal(result.state, "ready");
  assert.deepEqual(result.pullRequests.map((pr) => pr.status), ["open", "approved", "draft", "inReview", "inReview", "closed", "merged"]);
  const first = result.pullRequests[0];
  assert.equal(first?.githubId, "9007199254740993");
  assert.equal(first?.authorLogin, "ghost");
  assert.equal(first?.authorAvatarUrl, null);
  assert.equal(first?.reviewState, "none");
  assert.equal(first?.baseSha, "base");
  assert.equal(first?.headSha, "head");
});

test("inaccessible or malformed PR responses cannot populate the cache as successful empty results", async () => {
  await assert.rejects(readPullRequestsFromGitHub("team/review", async () => ({ data: { repository: null } })));
  await assert.rejects(readPullRequestsFromGitHub("team/review", async () => ({
    data: { repository: { pullRequests: { nodes: [{ ...pullRequest, state: "UNKNOWN" }] } } },
  })));
});
