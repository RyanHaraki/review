import type { DraftTarget, PullRequestDraft, PullRequestKey, PullRequestOverview } from "@review/contracts";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DraftComposer } from "./draft-composer";
import { MarkdownContent } from "./markdown-content";

type Props = { pullRequestKey: PullRequestKey; overview: PullRequestOverview; draft: PullRequestDraft | undefined; editing: boolean; loadingDrafts: boolean; onEdit: () => void; onClose: () => void };
export function PullRequestDescription({ pullRequestKey, overview, draft, editing, loadingDrafts, onEdit, onClose }: Props) {
  const target = useMemo<DraftTarget>(() => ({ kind: "description", originalBody: overview.body }), [overview.body]);
  return <section className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Description</h2>{overview.canEdit && !editing && !draft && !loadingDrafts && <Button size="xs" variant="ghost" onClick={onEdit}>Edit</Button>}</div>
    {overview.canEdit && (editing || draft) ? <DraftComposer key="description" pullRequestKey={pullRequestKey} target={draft?.target ?? target} draft={draft} initialBody={overview.body} onClose={onClose} onSubmitted={onClose} placeholder="Write a PR description in Markdown." /> : overview.body ? <MarkdownContent body={overview.body} /> : <p className="text-sm text-text-secondary">No description provided.</p>}
  </section>;
}
