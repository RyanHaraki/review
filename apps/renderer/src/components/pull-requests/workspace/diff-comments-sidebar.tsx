import { useCallback } from "react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { PullRequestDiff, PullRequestDraft, PullRequestKey, PullRequestThread } from "@review/contracts";
import { Button } from "../../ui/button";
import { DraftComposer } from "./draft-composer";
import { ReviewThreadBubble } from "./review-thread-bubble";

type Props = {
  pullRequestKey: PullRequestKey; diff: PullRequestDiff; drafts: PullRequestDraft[];
  threads: PullRequestThread[]; loading: boolean; path: string | null;
  onClose(): void; onShowAll(): void; onSelect(thread: PullRequestThread): void;
};

export function DiffCommentsSidebar({ pullRequestKey, diff, drafts, threads, loading, path, onClose, onShowAll, onSelect }: Props) {
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => { if (event.key === "Escape") onClose(); }, [onClose]);
  const visibleThreads = threads.filter((thread) => path === null || thread.path === path);
  const visibleDrafts = drafts.filter((draft) => {
    const target = draft.target;
    return draft.status !== "submitted" && (target.kind === "line"
      ? path === null || target.anchor.path === path
      : target.kind === "reply" && !threads.some((thread) => thread.id === target.threadId) && path === null);
  });
  return (
    <aside id="diff-comments" aria-label="Review comments" onKeyDown={onKeyDown} className="diff-comments-sidebar h-[max(22rem,calc(100vh-21rem))] min-w-0 overflow-y-auto border-l border-border pl-4">
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between bg-page py-2"><h3 className="text-sm font-medium">Comments</h3><Button size="icon-sm" variant="ghost" aria-label="Close comments" onClick={onClose}><XIcon className="size-4" /></Button></div>
      {path && <div className="mb-4 space-y-2"><p className="break-all font-mono text-xs">{path}</p><Button size="sm" variant="text" onClick={onShowAll}>All comments</Button></div>}
      <div className="space-y-4">
        {visibleDrafts.map((draft) => <article key={draft.id} className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-3 break-all text-xs text-text-secondary">{draft.target.kind === "line" ? `${draft.target.anchor.path} · Lines ${draft.target.anchor.startLine}–${draft.target.anchor.line}` : "Previous thread"} · Draft</p>
          {draft.target.kind === "line" && (draft.target.anchor.headSha !== diff.headSha || draft.target.anchor.baseSha !== diff.baseSha) && <p className="mb-2 text-xs text-amber-800">This draft refers to an earlier version. Select the current lines and create a new comment before submitting.</p>}
          <DraftComposer pullRequestKey={pullRequestKey} target={draft.target} draft={draft} />
        </article>)}
        {visibleThreads.map((thread) => <div key={thread.id} className="space-y-2">{!path && <p className="break-all font-mono text-xs text-text-secondary">{thread.path}</p>}<ReviewThreadBubble pullRequestKey={pullRequestKey} thread={thread} drafts={drafts} onSelect={onSelect} /></div>)}
        {loading && <p role="status" className="text-sm text-text-secondary">Loading comments…</p>}
        {!loading && visibleDrafts.length + visibleThreads.length === 0 && <p className="py-4 text-sm text-text-tertiary">No comments yet. Select code to start a discussion.</p>}
      </div>
    </aside>
  );
}
