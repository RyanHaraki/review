import { CaretDownIcon, CaretRightIcon, FileIcon } from "@phosphor-icons/react";
import type { GuideFile } from "@review/contracts";
import type { ReactNode } from "react";

type Props = {
  file: Pick<GuideFile, "path" | "previousPath" | "additions" | "deletions">;
  expanded: boolean;
  onToggle(): void;
  actions?: ReactNode;
};

export function FileDiffHeader({ file, expanded, onToggle, actions }: Props) {
  return (
    <div className={`flex w-full items-center bg-surface font-sans text-text ${expanded ? "border-b border-border" : ""}`}>
      <button
        aria-label={`${expanded ? "Close" : "Open"} ${file.path}`}
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 text-left text-[13px] hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
        onClick={onToggle}
        type="button"
      >
        {expanded ? <CaretDownIcon aria-hidden="true" className="shrink-0 text-text-tertiary" /> : <CaretRightIcon aria-hidden="true" className="shrink-0 text-text-tertiary" />}
        <FileIcon aria-hidden="true" className="shrink-0 text-text-tertiary" />
        <span className="min-w-0 flex-1 break-all font-medium">
          {file.path}
          {file.previousPath && <span className="ml-2 font-normal text-text-secondary">← {file.previousPath}</span>}
        </span>
        {file.additions > 0 && <span className="shrink-0 text-[#1a7f37]">+{file.additions}</span>}
        {file.deletions > 0 && <span className="shrink-0 text-[#cf222e]">-{file.deletions}</span>}
      </button>
      {actions && <div className="shrink-0 pr-4 text-xs text-text-secondary">{actions}</div>}
    </div>
  );
}
