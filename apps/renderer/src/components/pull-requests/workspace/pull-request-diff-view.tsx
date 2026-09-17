import { useCallback, useMemo, useRef, useState } from "react";
import { CodeView, WorkerPoolContextProvider, type CodeViewHandle, type CodeViewReactOptions } from "@pierre/diffs/react";
import type { CodeViewItem, CodeViewLineSelection } from "@pierre/diffs";
import DiffsWorker from "@pierre/diffs/worker/worker.js?worker&inline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PullRequestKey, PullRequestDiff, PullRequestDraft, PullRequestThread } from "@review/contracts";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { useReviewedFiles } from "../../../pages/pull-requests/use-reviewed-files";
import { parseDiffFile } from "./diff-model";
import { DiffFileHeader } from "./diff-file-header";
import { DiffCommentsSidebar } from "./diff-comments-sidebar";

const poolOptions = { poolSize: 2, workerFactory: () => new DiffsWorker() };
const highlighterOptions = { theme: "pierre-light" };
const options: CodeViewReactOptions = {
  theme: "pierre-light", themeType: "light", diffStyle: "unified", stickyHeaders: true,
  enableLineSelection: true, overflow: "scroll", layout: { gap: 24, paddingTop: 0, paddingBottom: 24 },
  unsafeCSS: ":host { --diffs-font-size: 12px; --diffs-line-height: 22px; --diffs-bg: #f9fafa; }",
};
type Props = {
  pullRequestKey: PullRequestKey; diff: PullRequestDiff; threads: PullRequestThread[];
  drafts: PullRequestDraft[]; commentsLoading: boolean; refreshing: boolean; refresh(): void;
};

export function PullRequestDiffView({ pullRequestKey, diff, threads, drafts, commentsLoading, refreshing, refresh }: Props) {
  const viewer = useRef<CodeViewHandle<undefined>>(null);
  const [sidebar, setSidebar] = useState<{ path: string | null } | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const client = useQueryClient();
  const reviewed = useReviewedFiles({ key: pullRequestKey, baseSha: diff.baseSha, headSha: diff.headSha });
  const [expansion, setExpansion] = useState<Map<string, { reviewed: boolean; collapsed: boolean }>>(() => new Map());
  const sourceItems = useMemo<CodeViewItem[]>(() => diff.files.map((file) => {
    const content = parseDiffFile(file, `${diff.baseSha}:${diff.headSha}`);
    return content.kind === "ready"
      ? { id: file.path, type: "diff", fileDiff: content.metadata }
      : { id: file.path, type: "file", file: { name: file.path, contents: content.message, lang: "text" } };
  }), [diff]);
  const items = useMemo(() => sourceItems.map((item) => {
    const isReviewed = reviewed.paths.includes(item.id);
    const override = expansion.get(item.id);
    const collapsed = override?.reviewed === isReviewed ? override.collapsed : isReviewed;
    return { ...item, collapsed, version: collapsed ? 1 : 0 };
  }), [sourceItems, reviewed.paths, expansion]);
  const toggleExpanded = useCallback((path: string) => {
    const item = items.find((entry) => entry.id === path);
    setExpansion((current) => new Map(current).set(path, { reviewed: reviewed.paths.includes(path), collapsed: !item?.collapsed }));
    setSelection((current) => current?.id === path ? null : current);
  }, [items, reviewed.paths]);
  const fileMap = useMemo(() => new Map(diff.files.map((file) => [file.path, file])), [diff.files]);
  const showFileComments = useCallback((path: string) => setSidebar({ path }), []);
  const showComments = useCallback(() => setSidebar({ path: null }), []);
  const toggleComments = useCallback(() => setSidebar((current) => current ? null : { path: null }), []);
  const closeComments = useCallback(() => setSidebar(null), []);
  const select = useCallback((next: CodeViewLineSelection | null) => {
    setSelectionError(null);
    if (next?.range.endSide && next.range.endSide !== next.range.side) {
      setSelection(null); setSelectionError("Select lines on one side of the diff to add a comment.");
    } else setSelection(next);
  }, []);
  const setReviewed = useCallback((path: string, value: boolean) => {
    setExpansion((current) => {
      const next = new Map(current);
      next.delete(path);
      return next;
    });
    reviewed.toggle(path, value);
  }, [reviewed.toggle]);
  const renderHeader = useCallback((item: CodeViewItem) => {
    const file = fileMap.get(item.id);
    return file && <DiffFileHeader file={file} reviewed={reviewed.paths.includes(file.path)} pending={reviewed.pending} collapsed={item.collapsed ?? false} onExpanded={toggleExpanded} onReviewed={setReviewed} />;
  }, [fileMap, reviewed.paths, reviewed.pending, setReviewed, toggleExpanded]);
  const selectThread = useCallback((thread: PullRequestThread) => {
    if (thread.line === null || thread.isOutdated) return;
    const path = fileMap.has(thread.path) ? thread.path : diff.files.find((file) => file.previousPath === thread.path)?.path;
    if (!path) return;
    setExpansion((current) => new Map(current).set(path, { reviewed: reviewed.paths.includes(path), collapsed: false }));
    const item = viewer.current?.getItem(path);
    if (item?.collapsed) viewer.current?.updateItem({ ...item, collapsed: false, version: 0 });
    const side = thread.side === "LEFT" ? "deletions" : "additions";
    select({ id: path, range: { start: thread.startLine ?? thread.line, end: thread.line, side } });
    viewer.current?.scrollTo({ type: "line", id: path, lineNumber: thread.line, side, align: "center" });
  }, [diff.files, fileMap, select, reviewed.paths]);
  const create = useMutation({
    mutationFn: async () => {
      if (!selection || !items.some((item) => item.id === selection.id && item.type === "diff" && !item.collapsed)) throw new Error("Select a line in a text diff first.");
      const { range } = selection;
      return window.reviewDesktop.savePullRequestDraft({ id: crypto.randomUUID(), key: pullRequestKey, body: "", expectedRevision: 0,
        target: { kind: "line", anchor: { path: selection.id, baseSha: diff.baseSha, headSha: diff.headSha,
          side: range.side === "deletions" ? "LEFT" : "RIGHT", startLine: Math.min(range.start, range.end), line: Math.max(range.start, range.end) } } });
    },
    onSuccess: (draft) => {
      client.setQueryData<PullRequestDraft[]>(["pull-request-drafts", pullRequestKey.repository, pullRequestKey.number], (current = []) => [...current, draft]);
      if (draft.target.kind === "line") showFileComments(draft.target.anchor.path);
    },
  });
  const { mutate: createDraft } = create;
  const addComment = useCallback(() => createDraft(), [createDraft]);
  const canComment = selection && items.some((item) => item.id === selection.id && item.type === "diff" && !item.collapsed);
  const reviewedCount = diff.files.filter((file) => reviewed.paths.includes(file.path)).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-auto text-sm text-text-secondary">{reviewedCount} / {diff.files.length} files reviewed</span>
        {canComment && <Button size="sm" variant="outline" onClick={addComment} disabled={!canComment || create.isPending}><ChatCircleIcon className="size-4" />{create.isPending ? "Saving…" : "Add comment"}</Button>}
        <Tooltip><TooltipTrigger render={<Button size="icon-sm" variant={sidebar ? "secondary" : "ghost"} aria-label="View comments" aria-expanded={sidebar !== null} aria-controls="diff-comments" onClick={toggleComments} />}><ChatCircleIcon className="size-4" /></TooltipTrigger><TooltipContent>View comments</TooltipContent></Tooltip>
        <Button size="icon-sm" variant="ghost" aria-label="Refresh diff and comments" onClick={refresh} disabled={refreshing}><ArrowClockwiseIcon className={refreshing ? "size-4 animate-spin" : "size-4"} /></Button>
      </div>
      {selectionError && <p role="status" className="text-xs text-text-secondary">{selectionError}</p>}
      {(create.error || reviewed.error) && <p role="alert" className="text-sm text-red-700">{(create.error ?? reviewed.error)?.message}</p>}
      <div className={sidebar ? "diff-review-layout diff-review-layout-open" : "diff-review-layout"}>
        <div className="min-w-0">
          {items.length > 0 ? <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
            <CodeView ref={viewer} key={`${diff.baseSha}:${diff.headSha}`} className="diff-scroll h-[max(22rem,calc(100vh-21rem))] overflow-auto" items={items} options={options} selectedLines={selection} onSelectedLinesChange={select} renderCustomHeader={renderHeader} />
          </WorkerPoolContextProvider> : <p className="py-16 text-center text-sm text-text-secondary">This pull request has no changed files.</p>}
        </div>
        {sidebar && <DiffCommentsSidebar pullRequestKey={pullRequestKey} diff={diff} threads={threads} drafts={drafts} loading={commentsLoading} path={sidebar.path} onClose={closeComments} onShowAll={showComments} onSelect={selectThread} />}
      </div>
    </div>
  );
}
