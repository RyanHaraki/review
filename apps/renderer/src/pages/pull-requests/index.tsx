import type { GitHubRepositoryChoice } from "@review/contracts";
import { useMemo, useState } from "react";

import { PullRequestGroup } from "../../components/pull-requests/pull-request-group";
import { Button } from "../../components/ui/button";
import { CheckboxIndicator } from "../../components/ui/Checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "../../components/ui/Combobox";
import { readPreferences, savePreferences } from "../setup/setup-persistence";
import { useRepositories } from "../setup/use-repositories";
import { usePullRequests } from "./use-pull-requests";

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
  const initialRepositories = useMemo(() => readPreferences()?.repositories ?? [], []);
  const [repositories, setRepositories] = useState(initialRepositories);
  const repositorySetup = useRepositories(true);
  const selectedRepositoryValues = useMemo(() => new Set(repositories), [repositories]);
  const selectedRepositories = useMemo(
    () => repositorySetup.choices.filter((repository) => selectedRepositoryValues.has(repository.value)),
    [repositorySetup.choices, selectedRepositoryValues],
  );
  const { groups, loading, refresh } = usePullRequests(repositories);
  const pullRequestCount = groups.reduce((count, group) => count + group.pullRequests.length, 0);
  const repositorySelectionLabel = `${repositories.length} ${repositories.length === 1 ? "repo" : "repos"} selected`;

  const selectRepositories = (selected: GitHubRepositoryChoice[]) => {
    const values = selected.map((repository) => repository.value);
    setRepositories(values);
    savePreferences({ repositories: values });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Pull requests</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {loading ? "Loading your repositories" : `${pullRequestCount} open across ${repositories.length} repositories`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Combobox
            autoHighlight
            isItemEqualToValue={(repository, value) => repository.value === value.value}
            itemToStringLabel={(repository) => repository.label}
            itemToStringValue={(repository) => repository.value}
            items={repositorySetup.choices}
            multiple
            onValueChange={selectRepositories}
            value={selectedRepositories}
          >
            <ComboboxTrigger
              aria-label={`Filter pull requests by repository. ${repositorySelectionLabel}.`}
              disabled={repositorySetup.loading || repositorySetup.error}
              variant="toolbar"
            >
              {repositorySelectionLabel}
            </ComboboxTrigger>
            <ComboboxContent>
              <ComboboxInput aria-label="Search repositories" placeholder="Search repositories" />
              <ComboboxEmpty>No repositories found.</ComboboxEmpty>
              <ComboboxList>
                {(repository: GitHubRepositoryChoice) => (
                  <ComboboxItem key={repository.value} value={repository}>
                    <CheckboxIndicator checked={selectedRepositoryValues.has(repository.value)} />
                    <span className="min-w-0 flex-1 truncate">{repository.label}</span>
                    {repository.isPrivate && (
                      <span className="text-xs text-text-secondary">Private</span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </header>
      {loading ? (
        <PullRequestListSkeleton />
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => <PullRequestGroup group={group} key={group.repository} />)}
        </div>
      )}
    </main>
  );
}
