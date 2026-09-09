import type { PullRequestActivity } from "@review/contracts";
import { memo } from "react";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { GitCommitIcon } from "@phosphor-icons/react/dist/csr/GitCommit";
import { GitPullRequestIcon } from "@phosphor-icons/react/dist/csr/GitPullRequest";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { MarkdownContent } from "./markdown-content";

const icons = { comment: ChatCircleIcon, commit: GitCommitIcon, event: GitPullRequestIcon, review: CheckCircleIcon };
export const ActivityItem = memo(function ActivityItem({ activity }: { activity: PullRequestActivity }) {
  const Icon = icons[activity.kind];
  return <li className="relative flex gap-3 py-4">
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-selected text-text-secondary"><Icon size={15} /></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{activity.author?.login ?? "GitHub"}</span>
        <span className="text-text-secondary">{activity.summary}</span>
        <a href={activity.url} target="_blank" rel="noreferrer" className="text-xs text-text-tertiary hover:underline"><time dateTime={activity.createdAt}>{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "View on GitHub"}</time></a>
      </div>
      {activity.body && <MarkdownContent body={activity.body} className="mt-2" />}
    </div>
  </li>;
});
