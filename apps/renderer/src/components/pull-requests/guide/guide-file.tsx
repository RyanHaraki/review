import { useCallback, useMemo, useState } from "react";
import type { GuideFile as GuideFileData } from "@review/contracts";

import { Button } from "../../ui/button";
import { GuideDiff } from "./guide-diff";
import { FileDiffHeader } from "../diff/file-diff-header";
import { fileDiffCardClassName } from "../diff/file-diff-options";

export function GuideFile({ file, generated = false }: { file: GuideFileData; generated?: boolean }) {
  const [expanded, setExpanded] = useState(!generated);
  const toggle = useCallback(() => setExpanded((value) => !value), []);
  const patch = useMemo(() => {
    if (!file.patch) return null;
    const before = file.status === "added" ? "/dev/null" : `a/${file.previousPath ?? file.path}`;
    const after = file.status === "removed" ? "/dev/null" : `b/${file.path}`;
    return `diff --git a/${file.previousPath ?? file.path} b/${file.path}\n--- ${before}\n+++ ${after}\n${file.patch}\n`;
  }, [file]);
  return (
    <div className={fileDiffCardClassName}>
      <FileDiffHeader file={file} expanded={expanded} onToggle={toggle} />
      {expanded ? (
        <div>
          {patch ? <GuideDiff patch={patch} /> : (
            <p className="px-5 py-8 text-center text-sm text-text-secondary">
              {file.status === "renamed" && file.additions === 0 && file.deletions === 0
                ? `Renamed from ${file.previousPath ?? file.path}. No content changes.`
                : "No text diff is available for this file."}
            </p>
          )}
        </div>
      ) : generated && (
        <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-7 text-sm text-text-secondary">
          <span>Generated file</span>
          <Button onClick={toggle} size="sm" variant="text">Show diff</Button>
        </div>
      )}
    </div>
  );
}
