import { z } from "zod";

export const githubAccountSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  login: z.string().min(1),
  avatarUrl: z.string().nullable(),
});

export const githubSetupStatusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("unavailable"), message: z.string() }),
  z.object({ state: z.literal("disconnected"), message: z.string().nullable() }),
  z.object({
    state: z.literal("authorizing"),
    userCode: z.string(),
    verificationUri: z.string(),
    expiresAt: z.string(),
  }),
  z.object({ state: z.literal("connected"), account: githubAccountSchema }),
]);

export type GitHubAccount = z.infer<typeof githubAccountSchema>;
export type GitHubSetupStatus = z.infer<typeof githubSetupStatusSchema>;
