import { useCallback, useMemo, useState } from "react";
import { CaretDownIcon, CaretRightIcon, FileIcon } from "@phosphor-icons/react";
import type { GuideFile as GuideFileData } from "@review/contracts";

import { Button } from "../../ui/button";
import { GuideDiff } from "./guide-diff";

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
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
        onClick={toggle}
        type="button"
      >
        {expanded ? <CaretDownIcon className="shrink-0 text-text-tertiary" /> : <CaretRightIcon className="shrink-0 text-text-tertiary" />}
        <FileIcon className="shrink-0 text-text-tertiary" />
        <span className="min-w-0 flex-1 break-all font-medium">{file.path}</span>
        {file.additions > 0 && <span className="text-[#1a7f37]">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-[#cf222e]">-{file.deletions}</span>}
      </button>
      {expanded ? (
        <div className="border-t border-border">
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
