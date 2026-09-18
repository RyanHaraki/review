import { useEffect, useRef } from "react";
import { FileDiff, getSingularPatch, type FileDiffOptions } from "@pierre/diffs";

const options: FileDiffOptions<undefined> = {
  diffStyle: "unified",
  theme: "github-light",
  themeType: "light",
  disableFileHeader: true,
  overflow: "scroll",
  unsafeCSS: ":host { --diffs-font-size: 12px; --diffs-line-height: 22px; }",
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
