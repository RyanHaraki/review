import { z } from "zod";
import type { createGitHubSession } from "./github-session.js";
import type { LocalRequest } from "./pull-request-submissions.js";

type GitHubSessionManager = ReturnType<typeof createGitHubSession>;
export type GitHubOperation = Awaited<ReturnType<GitHubSessionManager["capture"]>> & {
  origin: string;
  local: LocalRequest;
};

export function createGitHubOperations(auth: Pick<GitHubSessionManager, "capture">, serverOrigin: string) {
  return async function withSession<Value>(operation: (context: GitHubOperation) => Promise<Value>): Promise<Value> {
    const session = await auth.capture();
    const origin = `${serverOrigin}/accounts/${session.accountId}`;
    const local: LocalRequest = async (path, body, method: "POST" | "PUT" = "POST") => {
      const response = await fetch(`${origin}/pull-requests/details/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(z.object({ error: z.string() }).parse(result).error);
      return result;
    };
    const result = await operation({ ...session, origin, local });
    session.assertActive();
    return result;
  };
}

export type WithGitHubSession = ReturnType<typeof createGitHubOperations>;
