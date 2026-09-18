import { useEffect, useRef } from "react";
import { FileDiff, getSingularPatch, type FileDiffOptions } from "@pierre/diffs";
import { fileDiffOptions } from "../diff/file-diff-options";

const options: FileDiffOptions<undefined> = {
  ...fileDiffOptions,
  disableFileHeader: true,
};

export function GuideDiff({ patch }: { patch: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const renderer = new FileDiff(options);
    renderer.render({ fileDiff: getSingularPatch(patch), containerWrapper: host.current });
    return () => renderer.cleanUp();
  }, [patch]);
  return <div ref={host} />;
}
