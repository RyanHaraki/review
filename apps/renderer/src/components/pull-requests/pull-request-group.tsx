import type { PullRequestGroup as PullRequestGroupData } from "@review/contracts";

import { PullRequestRow } from "./pull-request-row";

export function PullRequestGroup({ group }: { group: PullRequestGroupData }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/_0.025)]">
      <header className="flex min-h-11 items-center justify-between gap-4 border-b border-border bg-panel/55 px-4 sm:px-5">
        <h2 className="truncate text-sm font-semibold">{group.repository}</h2>
        <span className="shrink-0 text-xs tabular-nums text-text-secondary">
          {group.pullRequests.length} open
        </span>
      </header>
      {group.state === "unavailable" ? (
        <p className="px-5 py-6 text-sm text-text-secondary">
          Review could not load pull requests for this repository.
        </p>
      ) : group.pullRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Open pull requests for {group.repository}</caption>
            <thead>
              <tr className="text-left text-[0.6875rem] font-medium text-text-tertiary">
                <th className="px-4 py-2 font-medium sm:px-5" scope="col">Title</th>
                <th className="hidden px-3 py-2 text-center font-medium sm:table-cell" scope="col">Review</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell" scope="col">Changes</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5" scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {group.pullRequests.map((pullRequest) => (
                <PullRequestRow key={pullRequest.githubId} pullRequest={pullRequest} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
