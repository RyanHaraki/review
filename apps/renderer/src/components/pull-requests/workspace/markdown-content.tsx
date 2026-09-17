import ReactMarkdown from "react-markdown";
import { memo } from "react";
import remarkGfm from "remark-gfm";
import { MarkdownLink } from "./markdown-link";

const plugins = [remarkGfm];
const components = { a: MarkdownLink };

export const MarkdownContent = memo(function MarkdownContent({ body, className = "" }: { body: string; className?: string }) {
  return <div className={`pr-markdown min-w-0 break-words text-sm leading-6 text-text ${className}`}><ReactMarkdown remarkPlugins={plugins} components={components} skipHtml>{body}</ReactMarkdown></div>;
});
