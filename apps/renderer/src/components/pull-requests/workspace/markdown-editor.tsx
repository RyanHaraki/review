import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "./markdown-content";

type Props = { value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string };
export function MarkdownEditor({ value, onChange, disabled = false, placeholder = "Write a comment. Markdown is supported." }: Props) {
  const [preview, setPreview] = useState(false);
  const showWrite = useCallback(() => setPreview(false), []);
  const showPreview = useCallback(() => setPreview(true), []);
  const change = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value), [onChange]);
  return <div className="overflow-hidden rounded-lg border border-border bg-white/70">
    <div className="flex gap-1 border-b border-border px-2 py-1.5">
      <Button variant={preview ? "ghost" : "secondary"} size="xs" onClick={showWrite} aria-pressed={!preview}>Write</Button>
      <Button variant={preview ? "secondary" : "ghost"} size="xs" onClick={showPreview} aria-pressed={preview}>Preview</Button>
    </div>
    {preview ? <div className="min-h-28 p-3">{value ? <MarkdownContent body={value} /> : <p className="text-sm text-text-secondary">Nothing to preview.</p>}</div> : <textarea aria-label={placeholder} placeholder={placeholder} value={value} onChange={change} disabled={disabled} maxLength={65000} className="block min-h-28 w-full resize-y bg-transparent p-3 text-sm leading-6 outline-none placeholder:text-text-tertiary focus-visible:ring-1 focus-visible:ring-focus" />}
  </div>;
}
