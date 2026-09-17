import { useCallback, useMemo, useState } from "react";
import type { DraftTarget, PullRequestDraft, PullRequestKey, PullRequestThread } from "@review/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Button } from "../../ui/button";
import { MarkdownContent } from "./markdown-content";
import { DraftComposer } from "./draft-composer";
import { formatPullRequestTime } from "./pull-request-workspace-types";

type ReviewThreadBubbleProps = {
  pullRequestKey: PullRequestKey;
  thread: PullRequestThread;
  drafts: PullRequestDraft[];
  onSelect(thread: PullRequestThread): void;
};

export function ReviewThreadBubble({ pullRequestKey, thread, drafts, onSelect }: ReviewThreadBubbleProps) {
  const [replying, setReplying] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const client = useQueryClient();
  const replyDrafts = useMemo(() => drafts.filter((draft) => draft.status !== "submitted" && draft.id !== activeDraftId && draft.target.kind === "reply" && draft.target.threadId === thread.id), [drafts, thread.id, activeDraftId]);
  const firstComment = thread.comments[0];
  const target = useMemo<DraftTarget | null>(() => firstComment
    ? { kind: "reply", threadId: thread.id, commentId: firstComment.databaseId }
    : null, [firstComment, thread.id]);
  const resolution = useMutation({
    mutationFn: () => window.reviewDesktop.setPullRequestThreadResolved({ key: pullRequestKey, threadId: thread.id, resolved: !thread.isResolved }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["pull-request-overview", pullRequestKey.repository, pullRequestKey.number] }); },
  });
  const toggleResolution = useCallback(() => resolution.mutate(), [resolution]);
  const select = useCallback(() => onSelect(thread), [onSelect, thread]);
  const openReply = useCallback(() => setReplying(true), []);
  const closeReply = useCallback(() => { setReplying(false); setActiveDraftId(null); }, []);
  const canToggleResolution = thread.isResolved ? thread.canUnresolve : thread.canResolve;

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-[0_2px_8px_rgb(0_0_0_/_0.03)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <Button size="sm" variant="text" onClick={select} disabled={thread.line === null || thread.isOutdated}>
          {thread.line === null ? "Previous version" : `Line ${thread.line}`}
        </Button>
        {thread.isOutdated && <span>Outdated</span>}
        {thread.isResolved && <span className="inline-flex items-center gap-1 text-status-complete"><CheckCircleIcon />Resolved</span>}
      </div>
      <div className="space-y-4">
        {thread.comments.map((comment) => (
          <div key={comment.id}>
            <div className="mb-1.5 flex items-center gap-2 text-xs">
              {comment.author?.avatarUrl && <img className="size-5 rounded-full" alt="" src={comment.author.avatarUrl} loading="lazy" />}
              <span className="font-medium">{comment.author?.login ?? "Deleted user"}</span>
              <a className="ml-auto text-text-tertiary" href={comment.url} target="_blank" rel="noreferrer"><time dateTime={comment.createdAt}>{formatPullRequestTime(comment.createdAt)}</time></a>
            </div>
            <MarkdownContent body={comment.body} />
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {replyDrafts.map((draft) => <DraftComposer key={draft.id} pullRequestKey={pullRequestKey} target={draft.target} draft={draft} />)}
        {replying && target && <DraftComposer pullRequestKey={pullRequestKey} target={target} onDraftCreated={setActiveDraftId} onClose={closeReply} onSubmitted={closeReply} placeholder="Write a reply in Markdown…" />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {target && !replying && <Button size="sm" variant="text" onClick={openReply}>Reply</Button>}
        {canToggleResolution && <Button size="sm" variant="text" onClick={toggleResolution} disabled={resolution.isPending}>{thread.isResolved ? "Reopen thread" : "Resolve thread"}</Button>}
      </div>
      {resolution.isError && <p role="alert" className="mt-2 text-xs text-red-700">{resolution.error.message}</p>}
    </article>
  );
}
