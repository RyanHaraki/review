import type { PullRequestSummary } from "@review/contracts";

import { PullRequestRow } from "./pull-request-row";

type PullRequestGroupProps = {
  label: string;
  pullRequests: PullRequestSummary[];
};

export function PullRequestGroup({ label, pullRequests }: PullRequestGroupProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/_0.025)]">
      <header className="flex min-h-11 items-center justify-between gap-4 border-b border-border bg-panel/55 px-4 sm:px-5">
        <h2 className="truncate text-sm font-semibold">{label}</h2>
        <span className="shrink-0 text-xs tabular-nums text-text-secondary">
          {pullRequests.length} {pullRequests.length === 1 ? "pull request" : "pull requests"}
        </span>
      </header>
      {pullRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">{label} pull requests</caption>
            <thead>
              <tr className="text-left text-[0.6875rem] font-medium text-text-tertiary">
                <th className="px-4 py-2 font-medium sm:px-5" scope="col">Title</th>
                <th className="hidden px-3 py-2 text-center font-medium sm:table-cell" scope="col">Review</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell" scope="col">Changes</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5" scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pullRequests.map((pullRequest) => (
                <PullRequestRow key={pullRequest.githubId} pullRequest={pullRequest} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
