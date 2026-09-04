import type { GitHubRepositoryChoice, PullRequestStatus } from "@review/contracts";

import { Button } from "../../ui/button";
import { ComboboxMultiSelect } from "../../ui/combobox";

type StatusChoice = {
  label: string;
  value: PullRequestStatus;
};

type PullRequestFiltersProps = {
  loading: boolean;
  onRefresh(): void;
  onSelectRepositories(repositories: GitHubRepositoryChoice[]): void;
  onSelectStatuses(statuses: StatusChoice[]): void;
  repositories: GitHubRepositoryChoice[];
  repositoryChoices: GitHubRepositoryChoice[];
  repositoryFilterDisabled: boolean;
  repositorySelectionLabel: string;
  selectedStatuses: StatusChoice[];
  statusChoices: StatusChoice[];
  statusSelectionLabel: string;
};

export function PullRequestFilters({
  loading,
  onRefresh,
  onSelectRepositories,
  onSelectStatuses,
  repositories,
  repositoryChoices,
  repositoryFilterDisabled,
  repositorySelectionLabel,
  selectedStatuses,
  statusChoices,
  statusSelectionLabel,
}: PullRequestFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ComboboxMultiSelect
        contentWidth="sm"
        disabled={repositoryFilterDisabled}
        emptyMessage="No repositories found."
        getItemLabel={(repository) => repository.label}
        getItemValue={(repository) => repository.value}
        items={repositoryChoices}
        onValueChange={onSelectRepositories}
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
        value={repositories}
      />
      <ComboboxMultiSelect
        contentWidth="sm"
        emptyMessage="No statuses found."
        getItemLabel={(status) => status.label}
        getItemValue={(status) => status.value}
        items={statusChoices}
        onValueChange={onSelectStatuses}
        searchLabel="Search statuses"
        triggerAriaLabel={`Filter pull requests by status. ${statusSelectionLabel}.`}
        triggerLabel={statusSelectionLabel}
        value={selectedStatuses}
      />
      <Button disabled={loading} onClick={onRefresh} size="sm" variant="outline">
        Refresh
      </Button>
    </div>
  );
}
