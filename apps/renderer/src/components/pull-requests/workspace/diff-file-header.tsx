import { memo, useCallback } from "react";
import type { PullRequestDiffFile } from "@review/contracts";
import { FileDiffHeader } from "../diff/file-diff-header";

type Props = {
  file: PullRequestDiffFile; reviewed: boolean; pending: boolean; collapsed: boolean;
  onExpanded(path: string): void;
  onReviewed(path: string, reviewed: boolean): void;
};

export const DiffFileHeader = memo(function DiffFileHeader({ file, reviewed, pending, collapsed, onExpanded, onReviewed }: Props) {
  const expand = useCallback(() => onExpanded(file.path), [file.path, onExpanded]);
  const toggle = useCallback(() => onReviewed(file.path, !reviewed), [file.path, reviewed, onReviewed]);
  return (
    <FileDiffHeader file={file} expanded={!collapsed} onToggle={expand} actions={
      <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" aria-label={`Reviewed ${file.path}`} checked={reviewed} disabled={pending} onChange={toggle} className="accent-accent" />Reviewed</label>
    } />
  );
});
