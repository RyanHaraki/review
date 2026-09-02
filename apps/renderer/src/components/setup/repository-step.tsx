import { Combobox } from "@base-ui/react/combobox";
import type { GitHubRepositoryChoice } from "@review/contracts";
import { useRef } from "react";
import { Button } from "../ui/button";

type RepositoryStepProps = {
  choices: GitHubRepositoryChoice[];
  selected: GitHubRepositoryChoice[];
  githubConnected: boolean;
  loading: boolean;
  error: boolean;
  onChange(repositories: GitHubRepositoryChoice[]): void;
  retry(): Promise<void>;
};

export function RepositoryStep({
  choices,
  selected,
  githubConnected,
  loading,
  error,
  onChange,
  retry,
}: RepositoryStepProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const complete = selected.length > 0;
  const icon = complete
    ? (
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full border border-black/12 bg-black/[0.055] text-[0.6875rem] font-[650] text-black/[0.62]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
          <path
            d="m5 10.5 3 3 7-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
    : (
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[0.6875rem] font-[650] text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.16)]"
        aria-hidden="true"
      >
        <span>3</span>
      </span>
    );

  return (
    <li className="grid gap-2 rounded-lg border border-transparent px-1 py-2 sm:px-2">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon}
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text">Repositories</span>
          <span className="text-xs leading-4 text-text-secondary">
            {!githubConnected ? (
              <>Connect GitHub to load repositories.</>
            ) : loading ? (
              <>Loading repositories.</>
            ) : error ? (
              <>Unable to load repositories from GitHub.</>
            ) : complete ? (
              <>{selected.length} {selected.length === 1 ? "repository" : "repositories"} selected.</>
            ) : (
              <>Choose at least one repository.</>
            )}
          </span>
        </div>
      </div>
      {error && githubConnected
        ? (
          <Button
            className="min-h-8 ms-9 w-fit rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,scale] duration-100 active:scale-[0.96] [@media(hover:hover)]:hover:bg-[#333331]"
            onClick={retry}
          >
            Try again
          </Button>
        )
        : (
          <Combobox.Root
            items={choices}
            itemToStringLabel={(repository) => repository.label}
            itemToStringValue={(repository) => repository.value}
            isItemEqualToValue={(repository, value) => repository.value === value.value}
            multiple
            autoHighlight
            value={selected}
            onValueChange={onChange}
          >
            <Combobox.Chips
              ref={anchor}
              className="ms-9 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border-strong bg-surface px-2 py-1 focus-within:border-focus has-[input:disabled]:opacity-55"
            >
              <Combobox.Value>
                {(values: GitHubRepositoryChoice[]) => (
                  <>
                    {values.map((repository) => (
                      <Combobox.Chip
                        key={repository.value}
                        className="flex min-h-6 max-w-full items-center gap-1 rounded-md bg-surface-selected ps-2 pe-1 text-xs font-medium text-text"
                      >
                        <span className="truncate">{repository.label}</span>
                        <Combobox.ChipRemove
                          aria-label={`Remove ${repository.label}`}
                          className="grid size-6 shrink-0 place-items-center rounded-md text-text-secondary outline-offset-1 focus-visible:outline-2 focus-visible:outline-focus [@media(hover:hover)]:hover:bg-black/[0.07] [@media(hover:hover)]:hover:text-text"
                        >
                          <span aria-hidden="true">×</span>
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input
                      aria-label="Repositories"
                      className="min-h-7 min-w-28 flex-1 bg-transparent px-1 text-xs text-text outline-none placeholder:text-text-tertiary"
                      disabled={!githubConnected || loading}
                      placeholder={values.length > 0 ? "Add repository" : "Search repositories"}
                    />
                  </>
                )}
              </Combobox.Value>
            </Combobox.Chips>
            <Combobox.Portal>
              <Combobox.Positioner
                anchor={anchor}
                sideOffset={8}
                className="z-50 w-[var(--anchor-width)] max-w-[calc(100vw-2rem)]"
              >
                <Combobox.Popup className="overflow-hidden rounded-xl border border-border-strong bg-surface text-text shadow-[0_18px_48px_rgb(35_38_36_/_0.16)] outline-none [color-scheme:light]">
                  <Combobox.Empty className="empty:p-0 px-3 py-6 text-center text-sm text-text-secondary">
                    No repositories found.
                  </Combobox.Empty>
                  <Combobox.List className="max-h-64 overflow-y-auto p-1.5">
                    {(repository: GitHubRepositoryChoice) => (
                      <Combobox.Item
                        key={repository.value}
                        value={repository}
                        className="flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-surface-hover data-[selected]:font-semibold [@media(hover:hover)]:hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1 truncate">{repository.label}</span>
                        {repository.isPrivate && <span className="text-xs text-text-secondary">Private</span>}
                        <Combobox.ItemIndicator className="text-text">
                          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                            <path
                              d="m3.5 8.5 2.5 2.5 6-6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        )}
    </li>
  );
}
