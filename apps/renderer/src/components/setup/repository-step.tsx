import { Combobox } from "@base-ui/react/combobox";
import type { GitHubRepositoryChoice } from "@review/contracts";
import { useRef } from "react";
import { SetupIcon } from "./setup-icon";
import { Button } from "../ui/button";

type RepositoryStepProps = {
  choices: GitHubRepositoryChoice[];
  selected: GitHubRepositoryChoice[];
  installationComplete: boolean;
  loading: boolean;
  error: boolean;
  onChange(repositories: GitHubRepositoryChoice[]): void;
  retry(): Promise<void>;
};

export function RepositoryStep({
  choices,
  selected,
  installationComplete,
  loading,
  error,
  onChange,
  retry,
}: RepositoryStepProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const complete = installationComplete && selected.length > 0;

  return (
    <li className="grid gap-2 rounded-lg border border-transparent px-1 py-2 sm:px-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <SetupIcon complete={complete} step={4} />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text">Choose repositories</span>
          <span className="text-xs leading-4 text-text-secondary">
            {!installationComplete ? (
              <>Install the GitHub app to choose repositories.</>
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
      {error && installationComplete
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
                      disabled={!installationComplete || loading}
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
