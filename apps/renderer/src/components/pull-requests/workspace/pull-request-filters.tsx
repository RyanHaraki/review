import type { GitHubRepositoryChoice, PullRequestStatus } from "@review/contracts";

import { useCallback, useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { FilterIcon } from "../../icons/filter-icon";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

type StatusChoice = {
  label: string;
  value: PullRequestStatus;
};

type FilterOption = {
  label: string;
  value: string;
};

type FilterSubmenuProps<Item extends FilterOption> = {
  disabled?: boolean;
  emptyMessage: string;
  getItemLabel(item: Item): string;
  items: Item[];
  onValueChange(value: Item[]): void;
  renderItem?(item: Item): ReactNode;
  searchLabel: string;
  submenuLabel: string;
  value: Item[];
};

function FilterSubmenu<Item extends FilterOption>({
  disabled = false,
  emptyMessage,
  getItemLabel,
  items,
  onValueChange,
  renderItem,
  searchLabel,
  submenuLabel,
  value,
}: FilterSubmenuProps<Item>) {
  const [search, setSearch] = useState("");
  const selectedValues = useMemo(() => new Set(value.map((item) => item.value)), [value]);
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return normalizedSearch
      ? items.filter((item) => getItemLabel(item).toLowerCase().includes(normalizedSearch))
      : items;
  }, [getItemLabel, items, search]);
  const updateSearch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  }, []);
  const toggleItem = useCallback((item: Item, checked: boolean) => {
    const nextValue = checked
      ? [...value, item]
      : value.filter((selectedItem) => selectedItem.value !== item.value);
    onValueChange(nextValue);
  }, [onValueChange, value]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>{submenuLabel}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <div className="border-b border-border p-1.5">
          <input
            aria-label={searchLabel}
            className="h-8 w-full rounded-lg bg-panel px-2.5 text-sm text-text outline-none placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-focus"
            onChange={updateSearch}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={searchLabel}
            type="search"
            value={search}
          />
        </div>
        {visibleItems.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-text-secondary">{emptyMessage}</p>
        ) : (
          <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {visibleItems.map((item) => (
              <DropdownMenuCheckboxItem
                checked={selectedValues.has(item.value)}
                key={item.value}
                onCheckedChange={(checked) => toggleItem(item, checked === true)}
              >
                <span aria-hidden="true" className="grid size-4 place-items-center rounded border border-border-strong data-[checked=true]:bg-accent" data-checked={selectedValues.has(item.value)}>
                  {selectedValues.has(item.value) && <span className="text-xs text-white">✓</span>}
                </span>
                {renderItem ? renderItem(item) : <span className="min-w-0 flex-1 truncate">{getItemLabel(item)}</span>}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

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
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Filters. ${repositorySelectionLabel}. ${statusSelectionLabel}.`}>
          <FilterIcon className="size-3.5" />
          <span>Filters</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <FilterSubmenu
            disabled={repositoryFilterDisabled}
            emptyMessage="No repositories found."
            getItemLabel={(repository) => repository.label}
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
            submenuLabel="Repo"
            value={repositories}
          />
          <FilterSubmenu
            emptyMessage="No statuses found."
            getItemLabel={(status) => status.label}
            items={statusChoices}
            onValueChange={onSelectStatuses}
            searchLabel="Search statuses"
            submenuLabel="Status"
            value={selectedStatuses}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button disabled={loading} onClick={onRefresh} size="sm" variant="outline">
        Refresh
      </Button>
    </div>
  );
}
