import type { DraftTarget, PullRequestDraft, PullRequestKey, SavePullRequestDraft } from "@review/contracts";
import { useState, useSyncExternalStore } from "react";

type EditorSnapshot = { body: string; saving: boolean; submitting: boolean; error: string | null; draft: PullRequestDraft | undefined };
type EditorInput = { pullRequestKey: PullRequestKey; target: DraftTarget; draft?: PullRequestDraft | undefined; initialBody?: string | undefined; onSaved?: ((draft: PullRequestDraft) => void) | undefined };


function sameTarget(target: DraftTarget, other: DraftTarget): boolean {
  switch (target.kind) {
    case "description": return other.kind === "description" && target.originalBody === other.originalBody;
    case "discussion": return other.kind === "discussion";
    case "reply": return other.kind === "reply" && target.threadId === other.threadId && target.commentId === other.commentId;
    case "line": return other.kind === "line"
      && target.anchor.path === other.anchor.path
      && target.anchor.baseSha === other.anchor.baseSha
      && target.anchor.headSha === other.anchor.headSha
      && target.anchor.side === other.anchor.side
      && target.anchor.startLine === other.anchor.startLine
      && target.anchor.line === other.anchor.line;
  }
}

async function recoverSave(attempt: SavePullRequestDraft): Promise<PullRequestDraft | undefined> {
  try {
    const drafts = await window.reviewDesktop.listPullRequestDrafts(attempt.key);
    return drafts.find((draft) => draft.id === attempt.id
      && draft.key.repository === attempt.key.repository && draft.key.number === attempt.key.number
      && draft.status === "draft" && draft.body === attempt.body
      && draft.revision === attempt.expectedRevision + 1 && sameTarget(draft.target, attempt.target));
  } catch {
    return undefined;
  }
}

function createEditor(input: EditorInput) {
  const id = input.draft?.id ?? crypto.randomUUID();
  let snapshot: EditorSnapshot = { body: input.draft?.body ?? input.initialBody ?? "", saving: false, submitting: false, error: input.draft?.error ?? null, draft: input.draft };
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  const listeners = new Set<() => void>();
  function update(next: Partial<EditorSnapshot>) {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  }
  function save(body: string) {
    if (snapshot.submitting || (snapshot.draft && snapshot.draft.status !== "draft")) return;
    pending += 1;
    update({ body, saving: true, error: null });
    tail = tail.then(async () => {
      const attempt = { id, key: input.pullRequestKey, target: input.target, body, expectedRevision: snapshot.draft?.revision ?? 0 };
      try {
        const draft = await window.reviewDesktop.savePullRequestDraft(attempt);
        update({ draft, error: null });
        input.onSaved?.(draft);
      } catch (error) {
        const recovered = await recoverSave(attempt);
        if (recovered) {
          update({ draft: recovered, error: null });
          input.onSaved?.(recovered);
        } else {
          update({ error: (error instanceof Error ? error.message : "Could not save the draft.") });
        }
      } finally {
        pending -= 1;
        update({ saving: pending > 0 });
      }
    });
  }
  async function submit() {
    update({ submitting: true });
    try {
      await tail;
      const draft = snapshot.draft;
      if ((snapshot.error && draft?.status === "draft") || !draft || draft.body !== snapshot.body) throw new Error(snapshot.error ?? "Save the draft before submitting.");
      const submitted = await window.reviewDesktop.submitPullRequestDraft({ key: input.pullRequestKey, id, revision: draft.revision });
      update({ draft: submitted, error: submitted.error });
      return submitted.status === "submitted";
    } catch (error) {
      try {
        const drafts = await window.reviewDesktop.listPullRequestDrafts(input.pullRequestKey);
        const latest = drafts.find((draft) => draft.id === id);
        if (latest) { update({ draft: latest }); input.onSaved?.(latest); }
      } catch { /* Keep the local draft when the status check fails. */ }
      update({ error: (error instanceof Error ? error.message : "Could not save the draft.") });
      return false;
    } finally { update({ submitting: false }); }
  }
  async function remove() {
    update({ submitting: true });
    try {
      await tail;
      if (snapshot.draft) await window.reviewDesktop.deletePullRequestDraft({ key: input.pullRequestKey, id, revision: snapshot.draft.revision });
      editors.delete(id);
      return true;
    } catch (error) { update({ error: (error instanceof Error ? error.message : "Could not save the draft.") }); return false; }
    finally { update({ submitting: false }); }
  }
  return { id, save, submit, remove, retry: () => save(snapshot.body), getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

const editors = new Map<string, ReturnType<typeof createEditor>>();

export function usePullRequestDraftEditor(input: EditorInput) {
  const [editor] = useState(() => {
    const existing = input.draft && editors.get(input.draft.id);
    if (existing) return existing;
    const created = createEditor(input);
    editors.set(created.id, created);
    return created;
  });
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  return { ...state, save: editor.save, submit: editor.submit, remove: editor.remove, retry: editor.retry };
}
