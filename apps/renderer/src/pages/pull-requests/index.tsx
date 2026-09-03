import type {
  GitHubRepositoryChoice,
  PullRequestStatus,
  ReviewPreferences,
} from "@review/contracts";
import { useEffect, useMemo, useState } from "react";

import { PullRequestGroup } from "../../components/pull-requests/pull-request-group";
import { Button } from "../../components/ui/button";
import { ComboboxMultiSelect } from "../../components/ui/Combobox";
import { readPreferences, savePreferences } from "../setup/setup-persistence";
import { useRepositories } from "../setup/use-repositories";
import { usePullRequests } from "./use-pull-requests";

type StatusChoice = {
  label: string;
  value: PullRequestStatus;
};

const statusChoices: StatusChoice[] = [
  { label: "Draft", value: "draft" },
  { label: "Open", value: "open" },
  { label: "In review", value: "inReview" },
  { label: "Approved", value: "approved" },
  { label: "Merged", value: "merged" },
  { label: "Closed", value: "closed" },
];

const defaultStatusChoices = statusChoices.filter(
  (status) => status.value === "draft" || status.value === "open",
);
const emptyRepositories: string[] = [];

function PullRequestListSkeleton() {
  return (
    <div aria-label="Loading pull requests" className="grid gap-4" role="status">
      {[0, 1].map((group) => (
        <div className="overflow-hidden rounded-xl border border-border bg-surface" key={group}>
          <div className="h-11 animate-pulse border-b border-border bg-panel/70" />
          {[0, 1, 2].map((row) => (
            <div className="flex h-14 items-center gap-3 border-b border-border/70 px-5 last:border-b-0" key={row}>
              <span className="size-7 animate-pulse rounded-full bg-surface-selected" />
              <span className="h-3 w-1/2 animate-pulse rounded bg-surface-selected" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PullRequestsPage() {
  const [preferences, setPreferences] = useState<ReviewPreferences | null>(null);
  const [preferenceError, setPreferenceError] = useState(false);
  const repositories = preferences?.repositories ?? emptyRepositories;
  const selectedStatuses = useMemo(() => {
    if (!preferences) {
      return defaultStatusChoices;
    }
    return statusChoices.filter((status) =>
      preferences.pullRequestStatuses.includes(status.value));
  }, [preferences]);
  const repositorySetup = useRepositories(true);
  const selectedRepositoryValues = useMemo(() => new Set(repositories), [repositories]);
  const selectedRepositories = useMemo(
    () => repositorySetup.choices.filter((repository) => selectedRepositoryValues.has(repository.value)),
    [repositorySetup.choices, selectedRepositoryValues],
  );
  const { groups: repositoryGroups, loading, refresh } = usePullRequests(repositories);
  const pullRequests = useMemo(
    () => repositoryGroups.flatMap((group) => group.state === "ready" ? group.pullRequests : []),
    [repositoryGroups],
  );
  const selectedStatusValues = useMemo(
    () => new Set(selectedStatuses.map((status) => status.value)),
    [selectedStatuses],
  );
  const statusGroups = useMemo(
    () => statusChoices
      .filter((status) => selectedStatusValues.has(status.value))
      .map((status) => ({
        ...status,
        pullRequests: pullRequests
          .filter((pullRequest) => pullRequest.status === status.value)
          .toSorted((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt)),
      }))
      .filter((group) => group.pullRequests.length > 0),
    [pullRequests, selectedStatusValues],
  );
  const unavailableRepositoryCount = repositoryGroups.filter((group) => group.state === "unavailable").length;
  const repositorySelectionLabel = `${repositories.length} ${repositories.length === 1 ? "repo" : "repos"} selected`;
  const statusSelectionLabel = `${selectedStatuses.length} ${selectedStatuses.length === 1 ? "status" : "statuses"} selected`;

  useEffect(() => {
    void readPreferences()
      .then(setPreferences)
      .catch(() => setPreferenceError(true));
  }, []);

  const updatePreferences = (nextPreferences: ReviewPreferences) => {
    setPreferences(nextPreferences);
    setPreferenceError(false);
    void savePreferences(nextPreferences).catch(() => setPreferenceError(true));
  };

  const selectRepositories = (selected: GitHubRepositoryChoice[]) => {
    if (!preferences) {
      return;
    }
    const values = selected.map((repository) => repository.value);
    updatePreferences({ ...preferences, repositories: values });
  };

  const selectStatuses = (selected: StatusChoice[]) => {
    if (!preferences) {
      return;
    }
    updatePreferences({
      ...preferences,
      pullRequestStatuses: selected.map((status) => status.value),
    });
  };

  const pageLoading = preferences === null || loading;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Pull requests</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pageLoading
              ? "Loading pull requests"
              : `${pullRequests.length} pull requests across ${repositories.length} repositor${repositories.length > 1 ? "ies" : "y"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ComboboxMultiSelect
            disabled={repositorySetup.loading || repositorySetup.error}
            emptyMessage="No repositories found."
            getItemLabel={(repository) => repository.label}
            getItemValue={(repository) => repository.value}
            items={repositorySetup.choices}
            onValueChange={selectRepositories}
            renderItem={(repository) => (
              <>
                <span className="min-w-0 flex-1 truncate">{repository.label}</span>
                {repository.isPrivate && (
                  <span className="text-xs text-text-secondary">Private</span>
                )}
              </>
            )}
            searchLabel="Search repositories"
            triggerAriaLabel={`Filter pull requests by repository. ${repositorySelectionLabel}.`}
            triggerLabel={repositorySelectionLabel}
            value={selectedRepositories}
          />
          <ComboboxMultiSelect
            contentWidth="sm"
            emptyMessage="No statuses found."
            getItemLabel={(status) => status.label}
            getItemValue={(status) => status.value}
            items={statusChoices}
            onValueChange={selectStatuses}
            searchLabel="Search statuses"
            triggerAriaLabel={`Filter pull requests by status. ${statusSelectionLabel}.`}
            triggerLabel={statusSelectionLabel}
            value={selectedStatuses}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pageLoading}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </header>
      {pageLoading ? (
        <PullRequestListSkeleton />
      ) : (
        <>
          {preferenceError && (
            <p className="mb-4 text-sm text-text-secondary" role="status">
              Unable to save your preferences.
            </p>
          )}
          {unavailableRepositoryCount > 0 && (
            <p className="mb-4 text-sm text-text-secondary" role="status">
              Unable to load {unavailableRepositoryCount} {unavailableRepositoryCount === 1 ? "repository" : "repositories"}.
            </p>
          )}
          {statusGroups.length > 0 ? (
            <div className="grid gap-4">
              {statusGroups.map((group) => (
                <PullRequestGroup
                  key={group.value}
                  label={group.label}
                  pullRequests={group.pullRequests}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-text-secondary">
              No pull requests match the selected statuses.
            </p>
          )}
        </>
      )}
    </main>
  );
}
