import type { GuideChapter as GuideChapterData, GuideFile as GuideFileData } from "@review/contracts";

import { GuideFile } from "./guide-file";

export function GuideChapter({ chapter, files, index, total, generated = false, reveal, visibleFiles }: {
  chapter: GuideChapterData;
  files: Map<string, GuideFileData>;
  index: number;
  total: number;
  generated?: boolean;
  reveal: boolean;
  visibleFiles: number;
}) {
  return (
    <section className="guide-chapter">
      <div className={reveal ? "mb-5 guide-reveal" : "mb-5"}>
        <p className="mb-2 text-xs tabular-nums text-text-tertiary">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</p>
        <h3 className="text-xl font-semibold tracking-[-0.02em]">{chapter.title}</h3>
        <p className="mt-4 max-w-[76ch] whitespace-pre-line text-[15px] leading-7 text-text-secondary">
          {chapter.explanation.split(/(`[^`]+`)/g).map((part, partIndex) => part.startsWith("`") && part.endsWith("`")
            ? <code className="rounded bg-surface-selected px-1 py-0.5 text-[13px] text-text" key={partIndex}>{part.slice(1, -1)}</code>
            : part)}
        </p>
      </div>
      <div className="space-y-3">
        {chapter.filePaths.slice(0, visibleFiles).map((path) => {
          const file = files.get(path);
          return file ? (
            <div className={reveal ? "guide-reveal" : undefined} key={path}>
              <GuideFile file={file} generated={generated} />
            </div>
          ) : null;
        })}
      </div>
    </section>
  );
}
