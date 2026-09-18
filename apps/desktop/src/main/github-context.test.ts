import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { z } from "zod";
import { createGitHubOperations } from "./github-context.js";
import type { CapturedGitHubSession } from "./github-session.js";

test("late operations retain their original storage account and cannot return after logout", async () => {
  const paths: (string | undefined)[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = z.object({ port: z.number() }).parse(server.address());
  let activeAccount = "42";
  const auth = {
    async capture(): Promise<CapturedGitHubSession> {
      const accountId = activeAccount;
      return {
        accountId,
        request: async () => ({}),
        assertActive() { assert.equal(accountId, activeAccount, "Session changed"); },
      };
    },
  };
  const withSession = createGitHubOperations(auth, `http://127.0.0.1:${port}`);
  try {
    await assert.rejects(withSession(async ({ local }) => {
      activeAccount = "43";
      await local("drafts/finish", { status: "uncertain" });
      return "old account result";
    }), /Session changed/);
    await withSession(({ local }) => local("drafts/read", {}));
    assert.deepEqual(paths, [
      "/accounts/42/pull-requests/details/drafts/finish",
      "/accounts/43/pull-requests/details/drafts/read",
    ]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
