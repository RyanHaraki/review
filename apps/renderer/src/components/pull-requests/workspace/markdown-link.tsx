import type { ComponentProps } from "react";

export function MarkdownLink({ children, href, title }: ComponentProps<"a">) {
  return <a href={href} title={title} target="_blank" rel="noreferrer noopener">{children}</a>;
}
