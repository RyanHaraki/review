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
import { requestGitHub } from "./pull-request-github.js";
import {
  readOverviewDocument,
  readDiffDocument,
} from "./pull-request-documents.js";
import {
  resolveThread,
  submitDraft,
  type LocalRequest,
} from "./pull-request-submissions.js";

export function registerPullRequestDetails(origin: string) {
  const local: LocalRequest = async (
    path,
    body,
    method: "POST" | "PUT" = "POST",
  ) => {
    const response = await fetch(`${origin}/pull-requests/details/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    if (!response.ok)
      throw new Error(z.object({ error: z.string() }).parse(result).error);
    return result;
  };
  ipcMain.handle("pull-requests:reviewed-read", async (_event, input: FileReviewKey) =>
    z.array(z.string()).parse(await local("reviewed/read", fileReviewKeySchema.parse(input))),
  );
  ipcMain.handle("pull-requests:reviewed-write", async (_event, input: SetFileReviewed) => {
    await local("reviewed/write", setFileReviewedSchema.parse(input), "PUT");
  });
  ipcMain.handle(
    "pull-requests:overview",
    async (_event, input: PullRequestKey) => {
      const key = pullRequestKeySchema.parse(input);
      return readOverviewDocument(key, requestGitHub, local);
    },
  );
  ipcMain.handle(
    "pull-requests:diff",
    async (_event, input: PullRequestKey) => {
      const key = pullRequestKeySchema.parse(input);
      return readDiffDocument(key, requestGitHub, local);
    },
  );
  ipcMain.handle(
    "pull-requests:drafts-list",
    async (_event, input: PullRequestKey) =>
      z
        .array(pullRequestDraftSchema)
        .parse(await local("drafts/read", pullRequestKeySchema.parse(input))),
  );
  ipcMain.handle(
    "pull-requests:draft-save",
    async (_event, input: SavePullRequestDraft) =>
      pullRequestDraftSchema.parse(
        await local(
          "drafts/save",
          savePullRequestDraftSchema.parse(input),
          "PUT",
        ),
      ),
  );
  ipcMain.handle(
    "pull-requests:draft-delete",
    async (_event, input: DraftReference) => {
      await local("drafts/delete", draftReferenceSchema.parse(input));
    },
  );
  ipcMain.handle(
    "pull-requests:draft-submit",
    async (_event, input: DraftReference) =>
      submitDraft(draftReferenceSchema.parse(input), requestGitHub, local),
  );
  ipcMain.handle(
    "pull-requests:thread-resolve",
    async (_event, input: ThreadResolution) => {
      const value = threadResolutionSchema.parse(input);
      await resolveThread(
        value.key,
        value.threadId,
        value.resolved,
        requestGitHub,
      );
    },
  );
}
