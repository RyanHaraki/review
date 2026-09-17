import { z } from "zod";

export const pullRequestKeySchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  number: z.number().int().positive(),
});
export type PullRequestKey = z.infer<typeof pullRequestKeySchema>;

export const pullRequestActorSchema = z.object({ login: z.string(), avatarUrl: z.string().nullable() });
export const pullRequestActivitySchema = z.object({
  id: z.string(), kind: z.enum(["comment", "review", "commit", "event"]),
  author: pullRequestActorSchema.nullable(), body: z.string(), summary: z.string(),
  createdAt: z.string(), url: z.string(),
});
export type PullRequestActivity = z.infer<typeof pullRequestActivitySchema>;
export const pullRequestCommentSchema = z.object({
  id: z.string(), databaseId: z.number().int(), author: pullRequestActorSchema.nullable(),
  body: z.string(), createdAt: z.string(), url: z.string(),
});
export const pullRequestThreadSchema = z.object({
  id: z.string(), path: z.string(), line: z.number().int().nullable(),
  startLine: z.number().int().nullable(), side: z.enum(["LEFT", "RIGHT"]),
  isResolved: z.boolean(), isOutdated: z.boolean(), canResolve: z.boolean(), canUnresolve: z.boolean(),
  comments: z.array(pullRequestCommentSchema),
});
export type PullRequestThread = z.infer<typeof pullRequestThreadSchema>;
export const pullRequestOverviewSchema = z.object({
  body: z.string(), updatedAt: z.string(), baseSha: z.string(), headSha: z.string(),
  canEdit: z.boolean(), viewerLogin: z.string(),
  activity: z.array(pullRequestActivitySchema), threads: z.array(pullRequestThreadSchema),
});
export type PullRequestOverview = z.infer<typeof pullRequestOverviewSchema>;
export const pullRequestDiffFileSchema = z.object({
  path: z.string(), previousPath: z.string().nullable(), status: z.string(),
  additions: z.number().int().nonnegative(), deletions: z.number().int().nonnegative(),
  patch: z.string().nullable(),
});
export type PullRequestDiffFile = z.infer<typeof pullRequestDiffFileSchema>;
export const pullRequestDiffSchema = z.object({
  baseSha: z.string(), headSha: z.string(), files: z.array(pullRequestDiffFileSchema),
});
export type PullRequestDiff = z.infer<typeof pullRequestDiffSchema>;

export const lineAnchorSchema = z.object({
  path: z.string().min(1), baseSha: z.string().min(1), headSha: z.string().min(1),
  side: z.enum(["LEFT", "RIGHT"]), startLine: z.number().int().positive(), line: z.number().int().positive(),
}).refine((anchor) => anchor.startLine <= anchor.line, "Invalid line range.");
export type LineAnchor = z.infer<typeof lineAnchorSchema>;
export const draftTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("description"), originalBody: z.string() }),
  z.object({ kind: z.literal("discussion") }),
  z.object({ kind: z.literal("line"), anchor: lineAnchorSchema }),
  z.object({ kind: z.literal("reply"), threadId: z.string().min(1), commentId: z.number().int().positive() }),
]);
export type DraftTarget = z.infer<typeof draftTargetSchema>;
export const savePullRequestDraftSchema = z.object({
  id: z.string().uuid(), key: pullRequestKeySchema, target: draftTargetSchema,
  body: z.string().max(65_000), expectedRevision: z.number().int().nonnegative(),
});
export type SavePullRequestDraft = z.infer<typeof savePullRequestDraftSchema>;
export const pullRequestDraftSchema = savePullRequestDraftSchema.omit({ expectedRevision: true }).extend({
  revision: z.number().int().positive(), updatedAt: z.string(),
  status: z.enum(["draft", "submitting", "submitted", "uncertain"]),
  error: z.string().nullable(), remoteUrl: z.string().nullable(),
});
export type PullRequestDraft = z.infer<typeof pullRequestDraftSchema>;
export const draftReferenceSchema = z.object({
  key: pullRequestKeySchema, id: z.string().uuid(), revision: z.number().int().positive(),
});
export type DraftReference = z.infer<typeof draftReferenceSchema>;
export const threadResolutionSchema = z.object({
  key: pullRequestKeySchema, threadId: z.string().min(1), resolved: z.boolean(),
});
export type ThreadResolution = z.infer<typeof threadResolutionSchema>;

export const fileReviewKeySchema = z.object({
  key: pullRequestKeySchema, baseSha: z.string().min(1), headSha: z.string().min(1),
});
export type FileReviewKey = z.infer<typeof fileReviewKeySchema>;
export const setFileReviewedSchema = fileReviewKeySchema.extend({ path: z.string().min(1), reviewed: z.boolean() });
export type SetFileReviewed = z.infer<typeof setFileReviewedSchema>;

export type PullRequestDetailsBridge = {
  readReviewedFiles(input: FileReviewKey): Promise<string[]>;
  setFileReviewed(input: SetFileReviewed): Promise<void>;
  readPullRequestOverview(key: PullRequestKey): Promise<PullRequestOverview>;
  readPullRequestDiff(key: PullRequestKey): Promise<PullRequestDiff>;
  listPullRequestDrafts(key: PullRequestKey): Promise<PullRequestDraft[]>;
  savePullRequestDraft(input: SavePullRequestDraft): Promise<PullRequestDraft>;
  deletePullRequestDraft(input: DraftReference): Promise<void>;
  submitPullRequestDraft(input: DraftReference): Promise<PullRequestDraft>;
  setPullRequestThreadResolved(input: ThreadResolution): Promise<void>;
};
