import { isDeepStrictEqual } from "node:util";

import {
  draftTargetSchema,
  pullRequestDiffSchema,
  pullRequestDraftSchema,
  pullRequestOverviewSchema,
  type DraftReference,
  type PullRequestDiff,
  type PullRequestDraft,
  type PullRequestKey,
  type PullRequestOverview,
  type SavePullRequestDraft,
} from "@review/contracts";
import { z } from "zod";

import type { ReviewDatabase } from "./client.js";

const draftRowSchema = z.object({
  id: z.string().uuid(),
  repository: z.string(),
  pull_request_number: z.number().int().positive(),
  target_json: z.string(),
  body: z.string(),
  revision: z.number().int().positive(),
  status: z.enum(["draft", "submitting", "submitted", "uncertain"]),
  error: z.string().nullable(),
  remote_url: z.string().nullable(),
  updated_at: z.string(),
});
type DraftRow = z.infer<typeof draftRowSchema>;

const detailDocumentRowSchema = z.object({
  content_json: z.string(),
  fetched_at: z.string(),
});

export type DetailDocumentKind = "overview" | "diff";
export type DetailDocument = PullRequestOverview | PullRequestDiff;

export type PullRequestDetailDocumentRead = {
  content: DetailDocument | null;
  fetchedAt: string | null;
};

export type PullRequestDetailDocumentWrite = {
  key: PullRequestKey;
  kind: DetailDocumentKind;
  revisionKey: string;
  content: DetailDocument;
};

export type FinishPullRequestDraft = DraftReference & {
  status: "draft" | "submitted" | "uncertain";
  error: string | null;
  remoteUrl: string | null;
};

export class PullRequestDraftConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PullRequestDraftConflictError";
  }
}

export class PullRequestDraftNotFoundError extends Error {
  constructor() {
    super("Pull request draft was not found.");
    this.name = "PullRequestDraftNotFoundError";
  }
}

function now(): string {
  return new Date().toISOString();
}

function readDraftRow(reviewDatabase: ReviewDatabase, reference: DraftReference): PullRequestDraft {
  const row = reviewDatabase.database.prepare(`
    SELECT id, repository, pull_request_number, target_json, body, revision, status, error, remote_url, updated_at
    FROM pull_request_drafts
    WHERE repository = ? AND pull_request_number = ? AND id = ?
  `).get(reference.key.repository, reference.key.number, reference.id);
  if (row === undefined) {
    throw new PullRequestDraftNotFoundError();
  }
  return toPullRequestDraft(draftRowSchema.parse(row));
}

function readDraftById(reviewDatabase: ReviewDatabase, id: string): PullRequestDraft | null {
  const row = reviewDatabase.database.prepare(`
    SELECT id, repository, pull_request_number, target_json, body, revision, status, error, remote_url, updated_at
    FROM pull_request_drafts
    WHERE id = ?
  `).get(id);
  return row === undefined ? null : toPullRequestDraft(draftRowSchema.parse(row));
}

function toPullRequestDraft(row: DraftRow): PullRequestDraft {
  return pullRequestDraftSchema.parse({
    id: row.id,
    key: { repository: row.repository, number: row.pull_request_number },
    target: draftTargetSchema.parse(JSON.parse(row.target_json)),
    body: row.body,
    revision: row.revision,
    updatedAt: row.updated_at,
    status: row.status,
    error: row.error,
    remoteUrl: row.remote_url,
  });
}

function assertCurrentRevision(draft: PullRequestDraft, reference: DraftReference): void {
  if (draft.revision !== reference.revision) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before trying again.");
  }
}

export function readPullRequestDrafts(
  reviewDatabase: ReviewDatabase,
  key: PullRequestKey,
): PullRequestDraft[] {
  const rows = reviewDatabase.database.prepare(`
    SELECT id, repository, pull_request_number, target_json, body, revision, status, error, remote_url, updated_at
    FROM pull_request_drafts
    WHERE repository = ? AND pull_request_number = ?
    ORDER BY updated_at DESC, id DESC
  `).all(key.repository, key.number);
  return rows.map((row) => toPullRequestDraft(draftRowSchema.parse(row)));
}

export function savePullRequestDraft(
  reviewDatabase: ReviewDatabase,
  input: SavePullRequestDraft,
): PullRequestDraft {
  const existing = readDraftById(reviewDatabase, input.id);

  if (!existing) {
    if (input.expectedRevision !== 0) {
      throw new PullRequestDraftConflictError("The pull request draft was deleted or changed.");
    }
    const timestamp = now();
    reviewDatabase.database.prepare(`
      INSERT INTO pull_request_drafts (
        id, repository, pull_request_number, target_json, body, revision, status, error, remote_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 'draft', NULL, NULL, ?, ?)
    `).run(
      input.id,
      input.key.repository,
      input.key.number,
      JSON.stringify(input.target),
      input.body,
      timestamp,
      timestamp,
    );
    return readDraftRow(reviewDatabase, { key: input.key, id: input.id, revision: 1 });
  }

  if (!isDeepStrictEqual(existing.key, input.key) || !isDeepStrictEqual(existing.target, input.target)) {
    throw new PullRequestDraftConflictError("A pull request draft's target cannot change.");
  }
  if (existing.status !== "draft") {
    throw new PullRequestDraftConflictError("This pull request draft is locked while it submits or after it submits.");
  }
  if (existing.revision !== input.expectedRevision) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before saving.");
  }

  const timestamp = now();
  const result = reviewDatabase.database.prepare(`
    UPDATE pull_request_drafts
    SET body = ?, revision = revision + 1, error = NULL, remote_url = NULL, updated_at = ?
    WHERE repository = ? AND pull_request_number = ? AND id = ? AND revision = ? AND status = 'draft'
  `).run(
    input.body,
    timestamp,
    input.key.repository,
    input.key.number,
    input.id,
    input.expectedRevision,
  );
  if (result.changes !== 1) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before saving.");
  }
  return readDraftRow(reviewDatabase, {
    key: input.key,
    id: input.id,
    revision: input.expectedRevision + 1,
  });
}

export function deletePullRequestDraft(reviewDatabase: ReviewDatabase, reference: DraftReference): void {
  const draft = readDraftRow(reviewDatabase, reference);
  assertCurrentRevision(draft, reference);
  if (draft.status !== "draft") {
    throw new PullRequestDraftConflictError("This pull request draft is locked while it submits or after it submits.");
  }
  const result = reviewDatabase.database.prepare(`
    DELETE FROM pull_request_drafts
    WHERE repository = ? AND pull_request_number = ? AND id = ? AND revision = ? AND status = 'draft'
  `).run(reference.key.repository, reference.key.number, reference.id, reference.revision);
  if (result.changes !== 1) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before deleting.");
  }
}

export function claimPullRequestDraft(
  reviewDatabase: ReviewDatabase,
  reference: DraftReference,
): PullRequestDraft {
  const draft = readDraftRow(reviewDatabase, reference);
  assertCurrentRevision(draft, reference);
  if (draft.status === "submitted") {
    return draft;
  }
  if (draft.status !== "draft") {
    throw new PullRequestDraftConflictError("This pull request draft needs reconciliation before it can submit.");
  }
  const result = reviewDatabase.database.prepare(`
    UPDATE pull_request_drafts
    SET status = 'submitting', error = NULL, updated_at = ?
    WHERE repository = ? AND pull_request_number = ? AND id = ? AND revision = ? AND status = 'draft'
  `).run(now(), reference.key.repository, reference.key.number, reference.id, reference.revision);
  if (result.changes !== 1) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before submitting.");
  }
  return readDraftRow(reviewDatabase, reference);
}

export function finishPullRequestDraft(
  reviewDatabase: ReviewDatabase,
  input: FinishPullRequestDraft,
): PullRequestDraft {
  const draft = readDraftRow(reviewDatabase, input);
  assertCurrentRevision(draft, input);
  const canFinish = draft.status === "submitting" || (draft.status === "uncertain" && input.status === "submitted");
  if (!canFinish) {
    throw new PullRequestDraftConflictError("This pull request draft cannot record that submission result.");
  }
  const result = reviewDatabase.database.prepare(`
    UPDATE pull_request_drafts
    SET status = ?, error = ?, remote_url = ?, updated_at = ?
    WHERE repository = ? AND pull_request_number = ? AND id = ? AND revision = ? AND status = ?
  `).run(
    input.status,
    input.error,
    input.remoteUrl,
    now(),
    input.key.repository,
    input.key.number,
    input.id,
    input.revision,
    draft.status,
  );
  if (result.changes !== 1) {
    throw new PullRequestDraftConflictError("The pull request draft changed. Refresh it before finishing submission.");
  }
  return readDraftRow(reviewDatabase, input);
}

export function readPullRequestDetailDocument(
  reviewDatabase: ReviewDatabase,
  key: PullRequestKey,
  kind: DetailDocumentKind,
  revisionKey: string,
): PullRequestDetailDocumentRead {
  const row = reviewDatabase.database.prepare(`
    SELECT content_json, fetched_at
    FROM pull_request_detail_documents
    WHERE repository = ? AND pull_request_number = ? AND kind = ? AND revision_key = ?
  `).get(key.repository, key.number, kind, revisionKey);
  if (row === undefined) {
    return { content: null, fetchedAt: null };
  }
  const document = detailDocumentRowSchema.parse(row);
  return {
    content: kind === "overview"
      ? pullRequestOverviewSchema.parse(JSON.parse(document.content_json))
      : pullRequestDiffSchema.parse(JSON.parse(document.content_json)),
    fetchedAt: document.fetched_at,
  };
}

export function writePullRequestDetailDocument(
  reviewDatabase: ReviewDatabase,
  input: PullRequestDetailDocumentWrite,
): void {
  reviewDatabase.database.prepare(`
    INSERT INTO pull_request_detail_documents (
      repository, pull_request_number, kind, revision_key, content_json, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository, pull_request_number, kind, revision_key)
    DO UPDATE SET content_json = excluded.content_json, fetched_at = excluded.fetched_at
  `).run(
    input.key.repository,
    input.key.number,
    input.kind,
    input.revisionKey,
    JSON.stringify(input.content),
    now(),
  );
}
