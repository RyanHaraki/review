import type { PullRequestReviewState, PullRequestSummary } from "@review/contracts";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatUpdatedAt(updatedAt: string): string {
  const elapsedMilliseconds = Date.parse(updatedAt) - Date.now();
  const elapsedMinutes = Math.round(elapsedMilliseconds / 60_000);
  if (Math.abs(elapsedMinutes) < 60) {
    return relativeTime.format(elapsedMinutes, "minute");
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeTime.format(elapsedHours, "hour");
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 30) {
    return relativeTime.format(elapsedDays, "day");
  }
  return relativeTime.format(Math.round(elapsedDays / 30), "month");
}

function ReviewStateIcon({ state }: { state: PullRequestReviewState }) {
  if (state === "approved") {
    return (
      <span aria-label="Approved" className="grid size-5 place-items-center rounded-full bg-[#2da44e] text-white">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
          <path d="m4 8 2.5 2.5L12 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (state === "changesRequested") {
    return (
      <span aria-label="Changes requested" className="grid size-5 place-items-center rounded-full bg-[#cf222e] text-white">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
          <path d="m5 5 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (state === "reviewRequired") {
    return <span aria-label="Review required" className="size-2 rounded-full bg-[#8250df]" />;
  }

  return <span aria-hidden="true" className="text-text-tertiary">—</span>;
}

export function PullRequestRow({ pullRequest }: { pullRequest: PullRequestSummary }) {
  return (
    <tr className="group border-t border-border/75 first:border-t-0 [@media(hover:hover)]:hover:bg-surface-hover/70">
      <td className="w-full px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {pullRequest.authorAvatarUrl ? (
            <img
              alt=""
              className="size-7 shrink-0 rounded-full bg-surface-selected object-cover ring-1 ring-black/8"
              height="28"
              loading="lazy"
              src={pullRequest.authorAvatarUrl}
              width="28"
            />
          ) : (
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-selected text-xs font-medium">
              {pullRequest.authorLogin.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <a
                className="truncate text-sm font-medium text-text outline-none focus-visible:underline"
                href={pullRequest.url}
                rel="noreferrer"
                target="_blank"
              >
                {pullRequest.title}
              </a>
              {pullRequest.isDraft && (
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[0.625rem] font-medium text-text-secondary">
                  Draft
                </span>
              )}
            </div>
            <p className="truncate text-xs leading-4 text-text-secondary">
              {pullRequest.authorLogin}<span aria-hidden="true"> · </span>{pullRequest.repository} #{pullRequest.number}
            </p>
          </div>
        </div>
      </td>
      <td className="relative hidden px-3 py-2.5 text-center sm:table-cell">
        <ReviewStateIcon state={pullRequest.reviewState} />
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums md:table-cell">
        <span className="text-[#1a7f37]">+{pullRequest.additions.toLocaleString()}</span>{" "}
        <span className="text-[#cf222e]">-{pullRequest.deletions.toLocaleString()}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-text-secondary tabular-nums sm:px-5">
        <time dateTime={pullRequest.updatedAt} title={new Date(pullRequest.updatedAt).toLocaleString()}>
          {formatUpdatedAt(pullRequest.updatedAt)}
        </time>
      </td>
    </tr>
  );
}
