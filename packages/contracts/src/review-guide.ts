import { z } from "zod";

export const guideKeySchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  number: z.number().int().positive(),
  baseSha: z.string().regex(/^[a-f0-9]{40,64}$/),
  headSha: z.string().regex(/^[a-f0-9]{40,64}$/),
});

export const guideFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().nullable(),
  status: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  patch: z.string().nullable(),
});

export const guideChapterSchema = z.object({
  title: z.string().min(1).max(100),
  explanation: z.string().min(1).max(3000),
  filePaths: z.array(z.string().min(1)).min(1),
});

export const guideOutlineSchema = z.object({
  chapters: z.array(guideChapterSchema).max(30),
  generatedFiles: z.array(z.string().min(1)),
});

export const reviewGuideSchema = guideOutlineSchema.extend({
  files: z.array(guideFileSchema),
  generatedAt: z.string(),
});

export const guideStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("missing") }),
  z.object({ kind: z.literal("generating"), startedAt: z.string() }),
  z.object({ kind: z.literal("ready"), guide: reviewGuideSchema }),
  z.object({ kind: z.literal("failed"), message: z.string() }),
]);

export const guideRecordSchema = z.object({
  key: guideKeySchema,
  state: guideStateSchema,
});

export type GuideKey = z.infer<typeof guideKeySchema>;
export type GuideFile = z.infer<typeof guideFileSchema>;
export type GuideOutline = z.infer<typeof guideOutlineSchema>;
export type GuideChapter = z.infer<typeof guideChapterSchema>;
export type ReviewGuide = z.infer<typeof reviewGuideSchema>;
export type GuideState = z.infer<typeof guideStateSchema>;
