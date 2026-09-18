import type { FileDiffOptions } from "@pierre/diffs";

export const fileDiffOptions = {
  diffStyle: "unified",
  theme: "github-light",
  themeType: "light",
  overflow: "scroll",
  unsafeCSS: ":host { --diffs-font-size: 12px; --diffs-line-height: 22px; }",
} satisfies FileDiffOptions<undefined>;

export const fileDiffCardClassName = "overflow-hidden rounded-xl border border-border bg-surface";
export const fileDiffCardCSS = ":host { box-sizing: border-box; overflow: hidden; border: 1px solid var(--color-border) !important; border-radius: 12px; background: var(--color-surface); }";
