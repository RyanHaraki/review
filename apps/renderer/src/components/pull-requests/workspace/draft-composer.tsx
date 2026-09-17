import type { DraftTarget, PullRequestDraft, PullRequestKey } from "@review/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePullRequestDraftEditor } from "@/pages/pull-requests/use-pull-request-draft-editor";
import { MarkdownEditor } from "./markdown-editor";

type Props = { pullRequestKey: PullRequestKey; target: DraftTarget; draft?: PullRequestDraft | undefined; initialBody?: string | undefined; onClose?: (() => void) | undefined; onSubmitted?: (() => void) | undefined; placeholder?: string | undefined; submitLabel?: string | undefined; onDraftCreated?: ((id: string) => void) | undefined };
function composerState(editor: ReturnType<typeof usePullRequestDraftEditor>, target: DraftTarget) {
  const status = editor.draft?.status;
  const locked = editor.submitting || status === "submitting" || status === "submitted" || status === "uncertain";
  const submitDisabled = locked || !editor.draft || !!editor.error || (target.kind !== "description" && !editor.body.trim());
  const saveLabel = editor.saving ? "Saving…" : editor.error ? "Save needs attention" : editor.draft ? "Saved locally" : "Markdown supported";
  return { status, locked, submitDisabled, saveLabel };
}

export function DraftComposer({ pullRequestKey, target, draft, initialBody, onClose, onSubmitted, placeholder, submitLabel = "Submit to GitHub", onDraftCreated }: Props) {
  const queryClient = useQueryClient();
  const onSaved = useCallback(async (saved: PullRequestDraft) => {
    onDraftCreated?.(saved.id);
    await queryClient.cancelQueries({ queryKey: ["pull-request-drafts", pullRequestKey.repository, pullRequestKey.number] });
    queryClient.setQueryData<PullRequestDraft[]>(["pull-request-drafts", pullRequestKey.repository, pullRequestKey.number], (previous = []) => {
      return previous.some((item) => item.id === saved.id)
        ? previous.map((item) => item.id === saved.id && item.revision <= saved.revision ? saved : item)
        : [...previous, saved];
    });
  }, [onDraftCreated, queryClient, pullRequestKey.repository, pullRequestKey.number]);
  const editor = usePullRequestDraftEditor({ pullRequestKey, target, draft, initialBody, onSaved });
  const [removed, setRemoved] = useState(false);
  const refresh = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["pull-request-drafts", pullRequestKey.repository, pullRequestKey.number] }),
      queryClient.invalidateQueries({ queryKey: ["pull-request-overview", pullRequestKey.repository, pullRequestKey.number] }),
    ]);
  }, [queryClient, pullRequestKey.repository, pullRequestKey.number]);
  const submit = useCallback(async () => {
    if (await editor.submit()) { onSubmitted?.(); await refresh(); }
  }, [editor.submit, onSubmitted, refresh]);
  const remove = useCallback(async () => {
    if (await editor.remove()) { setRemoved(true); onClose?.(); await refresh(); }
  }, [editor.remove, onClose, refresh]);
  const { status, locked, submitDisabled, saveLabel } = composerState(editor, target);
  if (removed) return null;
  if (status === "submitted") return <p className="text-xs text-text-secondary" role="status">Submitted to GitHub.</p>;
  return <div className="space-y-2" data-draft-id={editor.draft?.id}>
    <MarkdownEditor value={editor.body} onChange={editor.save} disabled={locked} {...(placeholder ? { placeholder } : {})} />
    {editor.error && <p className="text-xs text-red-700" role="alert">{editor.error}</p>}
    {status === "uncertain" && <p className="text-xs text-amber-800">GitHub may have received this comment. Check its submission status before you continue.</p>}
    {status === "submitting" && !editor.submitting && <p className="text-xs text-text-secondary">Submission is in progress. Refresh to check its result.</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="mr-auto basis-full text-xs text-text-secondary" aria-live="polite">{saveLabel}</span>
      {editor.error && !locked && <Button size="xs" variant="ghost" onClick={editor.retry}>Retry save</Button>}
      <Button size="xs" variant="ghost" onClick={remove} disabled={locked}>{editor.draft ? "Delete draft" : "Cancel"}</Button>
      {(status === "uncertain" || status === "submitting") && <Button size="sm" onClick={submit} disabled={editor.submitting}>Check submission</Button>}
      <Button size="sm" onClick={submit} disabled={submitDisabled}>{editor.submitting ? "Submitting…" : submitLabel}</Button>
    </div>
  </div>;
}
