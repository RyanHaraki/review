import type {
  PullRequestKey,
  FileReviewKey,
  SetFileReviewed,
  SavePullRequestDraft,
  DraftReference,
  ThreadResolution,
} from "@review/contracts";
import { ipcMain } from "electron";
import { z } from "zod";
import {
  fileReviewKeySchema,
  setFileReviewedSchema,
  draftReferenceSchema,
  pullRequestDraftSchema,
  pullRequestKeySchema,
  savePullRequestDraftSchema,
  threadResolutionSchema,
} from "@review/contracts";
import type { WithGitHubSession } from "./github-context.js";
import {
  readOverviewDocument,
  readDiffDocument,
} from "./pull-request-documents.js";
import {
  resolveThread,
  submitDraft,
} from "./pull-request-submissions.js";

export function registerPullRequestDetails(withSession: WithGitHubSession) {
  ipcMain.handle("pull-requests:reviewed-read", async (_event, input: FileReviewKey) =>
    withSession(async ({ local }) => z.array(z.string()).parse(await local("reviewed/read", fileReviewKeySchema.parse(input)))),
  );
  ipcMain.handle("pull-requests:reviewed-write", async (_event, input: SetFileReviewed) => {
    await withSession(({ local }) => local("reviewed/write", setFileReviewedSchema.parse(input), "PUT"));
  });
  ipcMain.handle(
    "pull-requests:overview",
    async (_event, input: PullRequestKey) => {
      const key = pullRequestKeySchema.parse(input);
      return withSession(({ request, local }) => readOverviewDocument(key, request, local));
    },
  );
  ipcMain.handle(
    "pull-requests:diff",
    async (_event, input: PullRequestKey) => {
      const key = pullRequestKeySchema.parse(input);
      return withSession(({ request, local }) => readDiffDocument(key, request, local));
    },
  );
  ipcMain.handle(
    "pull-requests:drafts-list",
    async (_event, input: PullRequestKey) =>
      withSession(async ({ local }) => z.array(pullRequestDraftSchema).parse(await local("drafts/read", pullRequestKeySchema.parse(input)))),
  );
  ipcMain.handle(
    "pull-requests:draft-save",
    async (_event, input: SavePullRequestDraft) =>
      withSession(async ({ local }) => pullRequestDraftSchema.parse(
        await local(
          "drafts/save",
          savePullRequestDraftSchema.parse(input),
          "PUT",
        ),
      )),
  );
  ipcMain.handle(
    "pull-requests:draft-delete",
    async (_event, input: DraftReference) => {
      await withSession(({ local }) => local("drafts/delete", draftReferenceSchema.parse(input)));
    },
  );
  ipcMain.handle(
    "pull-requests:draft-submit",
    async (_event, input: DraftReference) =>
      withSession(({ request, local }) => submitDraft(draftReferenceSchema.parse(input), request, local)),
  );
  ipcMain.handle(
    "pull-requests:thread-resolve",
    async (_event, input: ThreadResolution) => {
      const value = threadResolutionSchema.parse(input);
      await withSession(({ request }) => resolveThread(
        value.key,
        value.threadId,
        value.resolved,
        request,
      ));
    },
  );
}
