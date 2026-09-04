import type {
  GitHubRepositoryChoice,
  PullRequestStatus,
  PullRequestSummary,
} from "@review/contracts";
import { useCallback, useMemo, useState } from "react";

import { PullRequestFilters } from "../../components/pull-requests/workspace/pull-request-filters";
import { PullRequestWorkspace } from "../../components/pull-requests/workspace/pull-request-workspace";
import { PullRequestWorkspaceSkeleton } from "../../components/pull-requests/workspace/pull-request-workspace-skeleton";
import { useUserPreferences } from "../../hooks/use-user-preferences";
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

export function PullRequestsPage() {
  const { preferences, preferenceError, updatePreferences } = useUserPreferences();
  const [selectedPullRequestId, setSelectedPullRequestId] = useState<string | null>(null);
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
  const visiblePullRequests = useMemo(
    () => statusGroups.flatMap((group) => group.pullRequests),
    [statusGroups],
  );
  const selectedPullRequest = useMemo(
    () => visiblePullRequests.find((pullRequest) => pullRequest.githubId === selectedPullRequestId)
      ?? visiblePullRequests[0]
      ?? null,
    [selectedPullRequestId, visiblePullRequests],
  );
  const repositorySelectionLabel = `${repositories.length} ${repositories.length === 1 ? "repo" : "repos"} selected`;
  const statusSelectionLabel = `${selectedStatuses.length} ${selectedStatuses.length === 1 ? "status" : "statuses"} selected`;

  const selectRepositories = useCallback((selected: GitHubRepositoryChoice[]) => {
    if (!preferences) {
      return;
    }
    const values = selected.map((repository) => repository.value);
    void updatePreferences({ ...preferences, repositories: values }).catch(() => undefined);
  }, [preferences, updatePreferences]);

  const selectStatuses = useCallback((selected: StatusChoice[]) => {
    if (!preferences) {
      return;
    }
    void updatePreferences({
      ...preferences,
      pullRequestStatuses: selected.map((status) => status.value),
    }).catch(() => undefined);
  }, [preferences, updatePreferences]);

  const selectPullRequest = useCallback((pullRequest: PullRequestSummary) => {
    setSelectedPullRequestId(pullRequest.githubId);
  }, []);

  const refreshPullRequests = useCallback(() => {
    void refresh();
  }, [refresh]);

  const pageLoading = preferences === null || loading;

  if (pageLoading) {
    return <PullRequestWorkspaceSkeleton />;
  }

  const filters = (
    <PullRequestFilters
      loading={pageLoading}
      onRefresh={refreshPullRequests}
      onSelectRepositories={selectRepositories}
      onSelectStatuses={selectStatuses}
      repositories={selectedRepositories}
      repositoryChoices={repositorySetup.choices}
      repositoryFilterDisabled={repositorySetup.loading || repositorySetup.error}
      repositorySelectionLabel={repositorySelectionLabel}
      selectedStatuses={selectedStatuses}
      statusChoices={statusChoices}
      statusSelectionLabel={statusSelectionLabel}
    />
  );
  const notice = (
    <div aria-live="polite" className="grid gap-1 text-xs text-text-secondary" role="status">
      {preferenceError && <p>Unable to save your preferences.</p>}
      {unavailableRepositoryCount > 0 && (
        <p>
          Unable to load {unavailableRepositoryCount} {unavailableRepositoryCount === 1 ? "repository" : "repositories"}.
        </p>
      )}
      {statusGroups.length === 0 && <p>No pull requests match the selected statuses.</p>}
    </div>
  );
  const workspaceProps = {
    filters,
    notice,
    onSelect: selectPullRequest,
    pullRequestCount: visiblePullRequests.length,
    repositoryCount: repositories.length,
    selectedPullRequest,
    statusGroups,
  };

  return <PullRequestWorkspace {...workspaceProps} />;
}
