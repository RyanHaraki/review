import { memo, useCallback, type MouseEvent } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import type { PullRequestDiffFile } from "@review/contracts";
import { Button } from "../../ui/button";

type Props = {
  file: PullRequestDiffFile; reviewed: boolean; pending: boolean; collapsed: boolean;
  onExpanded(path: string): void;
  onReviewed(path: string, reviewed: boolean): void;
};

export const DiffFileHeader = memo(function DiffFileHeader({ file, reviewed, pending, collapsed, onExpanded, onReviewed }: Props) {
  const expand = useCallback(() => onExpanded(file.path), [file.path, onExpanded]);
  const toggle = useCallback(() => onReviewed(file.path, !reviewed), [file.path, reviewed, onReviewed]);
  const handleHeaderClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button, input, label")) return;
    expand();
  }, [expand]);
  return (
    <div className="flex min-h-12 w-full cursor-pointer items-center gap-3 border-y border-border bg-page px-3 text-xs text-text-secondary" onClick={handleHeaderClick}>
      <Button size="icon-sm" variant="ghost" aria-label={`${collapsed ? "Open" : "Close"} ${file.path}`} aria-expanded={!collapsed} onClick={expand}><CaretRightIcon className={collapsed ? "size-4" : "size-4 rotate-90"} /></Button>
      <div className="min-w-0 flex-1"><span className="break-all font-mono text-text">{file.path}</span>{file.previousPath && <span className="ml-2">← {file.previousPath}</span>}</div>
      <span className="shrink-0"><span className="text-green-700">+{file.additions}</span> <span className="text-red-600">−{file.deletions}</span></span>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5"><input type="checkbox" aria-label={`Reviewed ${file.path}`} checked={reviewed} disabled={pending} onChange={toggle} className="accent-accent" />Reviewed</label>
    </div>
  );
});
