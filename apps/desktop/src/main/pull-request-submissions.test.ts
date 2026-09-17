import {
  readDiffDocument,
  readOverviewDocument,
} from "./pull-request-documents.js";
import assert from "node:assert/strict";
import test from "node:test";
import type {
  PullRequestDraft,
  PullRequestDiff,
  LineAnchor,
} from "@review/contracts";
import {
  GitHubRejection,
  type GitHubRequest,
  readPages,
  readRemoteDiff,
} from "./pull-request-github.js";
import {
  submitDraft,
  validateAnchor,
  type LocalRequest,
} from "./pull-request-submissions.js";
import { z } from "zod";

const key = { repository: "example/repo", number: 7 };
const id = "10000000-0000-4000-8000-000000000001";
function newDraft(): PullRequestDraft {
  return {
    id,
    key,
    body: "Please change this.",
    target: { kind: "discussion" },
    revision: 1,
    updatedAt: "2026-09-07",
    status: "draft",
    error: null,
    remoteUrl: null,
  };
}
function storage(initial: PullRequestDraft) {
  let draft = initial;
  const calls: string[] = [];
  const local: LocalRequest = async (path, body) => {
    calls.push(path);
    if (path === "drafts/read") return [draft];
    if (path === "drafts/claim") {
      if (draft.status !== "draft") throw new Error("Claim conflict");
      draft = { ...draft, status: "submitting" };
      return draft;
    }
    if (path === "drafts/finish") {
      const result = z
        .object({
          status: z.enum(["draft", "submitted", "uncertain"]),
          error: z.string().nullable(),
          remoteUrl: z.string().nullable(),
        })
        .parse(body);
      draft = { ...draft, ...result };
      return draft;
    }
    throw new Error(path);
  };
  return { local, calls, read: () => draft };
}
function detail(head = "head") {
  return {
    data: {
      viewer: { login: "reviewer" },
      repository: {
        pullRequest: {
          body: "original",
          updatedAt: "2026-09-07",
          baseRefOid: "base",
          headRefOid: head,
          viewerCanUpdate: true,
          url: "https://github.com/example/repo/pull/7",
        },
      },
    },
  };
}
const reference = { key, id, revision: 1 };

test("save state is claimed before publication and a receipt prevents repeat sends", async () => {
  const store = storage(newDraft());
  let writes = 0;
  const github: GitHubRequest = async (path, body) => {
    if (path === "graphql") return detail();
    assert.equal(store.read().status, "submitting");
    assert.equal(
      body?.body,
      `Please change this.\n<!-- review-draft:${id} -->`,
    );
    writes += 1;
    return { html_url: "https://github.com/example/repo/pull/7#comment-1" };
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "submitted",
  );
  await submitDraft(reference, github, store.local);
  assert.equal(writes, 1);
});

test("timeout is uncertain; reconciliation scans later pages and never creates again", async () => {
  const store = storage(newDraft());
  let writes = 0;
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    if (path.includes("&page=1"))
      return Array.from({ length: 100 }, () => ({
        body: "other",
        user: { login: "reviewer" },
        html_url: "https://github.com/example/repo/pull/7#other",
      }));
    if (path.includes("&page=2"))
      return [
        {
          body: `Please change this.\n<!-- review-draft:${id} -->`,
          user: { login: "reviewer" },
          html_url: "https://github.com/example/repo/pull/7#posted",
        },
      ];
    writes += 1;
    throw new Error("Timed out after remote accepted request");
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "uncertain",
  );
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "submitted",
  );
  assert.equal(writes, 1);
});

test("unmatched uncertainty cannot trigger a duplicate write", async () => {
  const store = storage({ ...newDraft(), status: "uncertain" });
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    assert.match(path, /comments\?per_page/);
    return [];
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "uncertain",
  );
  assert.deepEqual(store.calls, ["drafts/read"]);
});

test("description conflict preserves editable draft without publication", async () => {
  const store = storage({
    ...newDraft(),
    target: { kind: "description", originalBody: "older" },
  });
  const github: GitHubRequest = async (path) => {
    assert.equal(path, "graphql");
    return detail();
  };
  const result = await submitDraft(reference, github, store.local);
  assert.equal(result.status, "draft");
  assert.match(result.error ?? "", /description changed/);
});

test("definite GitHub rejection preserves draft for an explicit retry", async () => {
  const store = storage(newDraft());
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    throw new GitHubRejection("HTTP 422");
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "draft",
  );
});

test("anchor checks reject changed SHAs, wrong sides, missing lines and cross-hunk ranges", () => {
  const diff: PullRequestDiff = {
    baseSha: "base",
    headSha: "head",
    files: [
      {
        path: "a.ts",
        previousPath: null,
        status: "modified",
        additions: 2,
        deletions: 1,
        patch: "@@ -1,2 +1,2 @@\n keep\n-old\n+new\n@@ -10 +10 @@\n+x",
      },
    ],
  };
  const anchor: LineAnchor = {
    baseSha: "base",
    headSha: "head",
    path: "a.ts",
    side: "RIGHT",
    startLine: 1,
    line: 2,
  };
  validateAnchor(anchor, diff);
  assert.throws(() => validateAnchor({ ...anchor, headSha: "changed" }, diff));
  assert.throws(() =>
    validateAnchor({ ...anchor, startLine: 10, line: 10, side: "LEFT" }, diff),
  );
  assert.throws(() => validateAnchor({ ...anchor, line: 10 }, diff));
  assert.throws(() => validateAnchor({ ...anchor, path: "wrong.ts" }, diff));
});

test("diff refuses a mixed revision response", async () => {
  let details = 0;
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail(++details === 1 ? "before" : "after");
    return [];
  };
  await assert.rejects(readRemoteDiff(key, github), /changed while loading/);
});

test("REST pagination consumes every full page", async () => {
  const values = await readPages("items", z.number(), async (path) =>
    path.includes("&page=1") ? Array.from({ length: 100 }, (_, i) => i) : [100],
  );
  assert.equal(values.length, 101);
});

test("Electron restart with a running local server reconciles a submitting row", async () => {
  const store = storage({ ...newDraft(), status: "submitting" });
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    assert.match(path, /comments\?per_page/);
    return [];
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "uncertain",
  );
  assert.equal(store.calls.includes("drafts/claim"), false);
});

test("concurrent clicks share the active publication instead of reconciling it", async () => {
  const store = storage(newDraft());
  let writes = 0;
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    writes += 1;
    return { html_url: "https://github.com/example/repo/pull/7#comment" };
  };
  const first = submitDraft(reference, github, store.local);
  const second = submitDraft(reference, github, store.local);
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(writes, 1);
  assert.equal(store.read().status, "submitted");
});

test("reconciliation preserves a receipt after the GitHub account changes", async () => {
  const store = storage({ ...newDraft(), status: "uncertain" });
  const github: GitHubRequest = async (path) => {
    if (path === "graphql") return detail();
    assert.equal(
      path,
      "repos/example/repo/issues/7/comments?per_page=100&page=1",
    );
    return [
      {
        body: `Please change this.\n<!-- review-draft:${id} -->`,
        user: { login: "previous-account" },
        html_url: "https://github.com/example/repo/pull/7#posted",
      },
    ];
  };
  assert.equal(
    (await submitDraft(reference, github, store.local)).status,
    "submitted",
  );
});

test("large diff survives unavailable cache reads and rejected cache writes", async () => {
  const patch = "@@ -1 +1 @@\n-" + "a".repeat(1_100_000) + "\n+b";
  const github: GitHubRequest = async (path) =>
    path === "graphql"
      ? detail()
      : [
          {
            filename: "large.txt",
            status: "modified",
            additions: 1,
            deletions: 1,
            patch,
          },
        ];
  const local: LocalRequest = async () => {
    throw new Error("Cache unavailable or body exceeds limit");
  };
  const diff = await readDiffDocument(key, github, local);
  assert.equal(diff.files[0]?.patch, patch);
});

test("successful overview remains available when cache write fails", async () => {
  const github: GitHubRequest = async (path, body) => {
    if (path !== "graphql") return [];
    if (String(body?.query).includes("reviewThreads"))
      return {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      };
    return detail();
  };
  const local: LocalRequest = async () => {
    throw new Error("Cache write failed");
  };
  assert.equal(
    (await readOverviewDocument(key, github, local)).body,
    "original",
  );
});
