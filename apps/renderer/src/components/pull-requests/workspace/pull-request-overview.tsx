import type { DraftTarget, PullRequestDraft, PullRequestKey } from "@review/contracts";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePullRequestOverview } from "@/pages/pull-requests/use-pull-request-overview";
import { usePullRequestDrafts } from "@/pages/pull-requests/use-pull-request-drafts";
import { ActivityItem } from "./activity-item";
import { DraftComposer } from "./draft-composer";
import { PullRequestDescription } from "./pull-request-description";

const discussionTarget: DraftTarget = { kind: "discussion" };
function visibleDrafts(drafts: PullRequestDraft[] = [], activeDraftId: string | null) {
  return {
    descriptionDraft: drafts.find((draft) => draft.target.kind === "description" && draft.status !== "submitted"),
    discussionDrafts: drafts.filter((draft) => draft.target.kind === "discussion" && draft.status !== "submitted" && draft.id !== activeDraftId),
  };
}

export function PullRequestOverview({ pullRequestKey }: { pullRequestKey: PullRequestKey }) {
  const overview = usePullRequestOverview(pullRequestKey);
  const drafts = usePullRequestDrafts(pullRequestKey);
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const startEdit = useCallback(() => setEditing(true), []);
  const stopEdit = useCallback(() => setEditing(false), []);
  const startComment = useCallback(() => setComposing(true), []);
  const stopComment = useCallback(() => { setComposing(false); setActiveDraftId(null); }, []);
  const refresh = useCallback(() => { void overview.refetch(); void drafts.refetch(); }, [overview.refetch, drafts.refetch]);
  const { descriptionDraft, discussionDrafts } = visibleDrafts(drafts.data, composing ? activeDraftId : null);
  if (overview.isPending) return <p className="py-8 text-sm text-text-secondary">Loading pull request…</p>;
  if (!overview.data) return <div className="space-y-3 py-8"><p role="alert" className="text-sm text-red-700">{overview.error?.message ?? "Could not load the pull request."}</p><Button onClick={refresh} size="sm" variant="outline">Retry</Button></div>;
  return <div className="mx-auto max-w-5xl space-y-10 py-5">
    {overview.isError && <p role="alert" className="text-sm text-red-700">Could not refresh this pull request. The last saved data is shown.</p>}
    {drafts.isError && <p role="alert" className="text-sm text-red-700">Could not load saved drafts. <Button variant="text" onClick={refresh}>Retry</Button></p>}
    <PullRequestDescription pullRequestKey={pullRequestKey} overview={overview.data} draft={descriptionDraft} editing={editing} loadingDrafts={drafts.isPending} onEdit={startEdit} onClose={stopEdit} />
    <section className="space-y-4">
      <h2 className="text-sm font-medium">Activity</h2>
      {overview.data.activity.length ? <ol className="divide-y divide-border">{overview.data.activity.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}</ol> : <p className="text-sm text-text-secondary">No activity yet.</p>}
      {discussionDrafts.map((draft) => <DraftComposer key={draft.id} pullRequestKey={pullRequestKey} target={draft.target} draft={draft} />)}
      {composing ? <DraftComposer pullRequestKey={pullRequestKey} target={discussionTarget} onDraftCreated={setActiveDraftId} onClose={stopComment} onSubmitted={stopComment} /> : <Button variant="outline" size="sm" onClick={startComment} disabled={drafts.isPending || drafts.isError}>Add comment</Button>}
    </section>
  </div>;
}
