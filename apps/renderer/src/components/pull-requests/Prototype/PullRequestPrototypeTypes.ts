import type { PullRequestStatus, PullRequestSummary } from "@review/contracts";
import type { ReactNode } from "react";

export type PullRequestStatusGroup = {
  label: string;
  pullRequests: PullRequestSummary[];
  value: PullRequestStatus;
};

export type PullRequestPrototypeProps = {
  filters: ReactNode;
  notice: ReactNode;
  onSelect(pullRequest: PullRequestSummary): void;
  pullRequestCount: number;
  repositoryCount: number;
  selectedPullRequest: PullRequestSummary | null;
  statusGroups: PullRequestStatusGroup[];
};

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatPullRequestTime(updatedAt: string): string {
  const elapsedMinutes = Math.round((Date.parse(updatedAt) - Date.now()) / 60_000);
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

export function getReviewStateLabel(pullRequest: PullRequestSummary): string {
  if (pullRequest.reviewState === "approved") {
    return "Approved";
  }
  if (pullRequest.reviewState === "changesRequested") {
    return "Changes requested";
  }
  if (pullRequest.reviewState === "reviewRequired") {
    return "Review required";
  }
  return "No review decision";
}
