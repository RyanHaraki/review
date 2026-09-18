import { useEffect, useMemo, useState } from "react";
import type { ReviewGuide } from "@review/contracts";

import { GuideChapter } from "./guide-chapter";

export function ReviewGuideContent({ guide, reveal }: { guide: ReviewGuide; reveal: boolean }) {
  const [motionAllowed] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const animate = reveal && motionAllowed;
  const [visibleCount, setVisibleCount] = useState(1);
  const files = useMemo(() => new Map(guide.files.map((file) => [file.path, file])), [guide.files]);
  const { chapters, totalBlocks } = useMemo(() => {
    const entries = guide.chapters.map((chapter) => ({ chapter, generated: false }));
    if (guide.generatedFiles.length > 0) {
      entries.push({
        chapter: { title: "Generated files", explanation: "Automatically generated files. Diffs are closed by default.", filePaths: guide.generatedFiles },
        generated: true,
      });
    }
    let offset = 0;
    const chapters = entries.map((entry) => {
      const start = offset;
      offset += 1 + entry.chapter.filePaths.length;
      return { ...entry, start };
    });
    return { chapters, totalBlocks: offset };
  }, [guide]);

  useEffect(() => {
    if (!animate || visibleCount >= totalBlocks) return;
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(totalBlocks, count + Math.ceil(totalBlocks / 24)));
    }, 50);
    return () => window.clearTimeout(timer);
  }, [animate, totalBlocks, visibleCount]);

  if (chapters.length === 0) return <p className="py-12 text-sm text-text-secondary">This pull request has no changed files.</p>;
  const visible = animate ? visibleCount : totalBlocks;
  return (
    <div className="review-guide space-y-12 pb-12 pt-5" aria-label="Review guide" aria-busy={visible < totalBlocks}>
      {chapters.map(({ chapter, generated, start }, index) => visible > start && (
        <GuideChapter
          chapter={chapter}
          files={files}
          generated={generated}
          index={index}
          key={index}
          reveal={animate}
          total={chapters.length}
          visibleFiles={Math.max(0, visible - start - 1)}
        />
      ))}
    </div>
  );
}
