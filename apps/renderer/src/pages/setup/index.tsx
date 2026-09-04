import type { GitHubRepositoryChoice } from "@review/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { CodexStep, GitHubStep } from "../../components/setup/connection-steps";
import { RepositoryStep } from "../../components/setup/repository-step";
import { Button } from "../../components/ui/button";
import { useUserPreferences } from "../../hooks/use-user-preferences";
import { useRepositories } from "./use-repositories";
import { useSetupStatus } from "./use-setup-status";

function SetupProgress({ completedSteps }: { completedSteps: number }) {
  const className = completedSteps === 3
    ? "size-3.5 rounded-full [--setup-progress:100%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
    : completedSteps === 2
      ? "size-3.5 rounded-full [--setup-progress:66.667%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
      : completedSteps === 1
        ? "size-3.5 rounded-full [--setup-progress:33.333%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
        : "size-3.5 rounded-full [--setup-progress:0%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]";

  return <span aria-hidden="true" className={className} />;
}

export function SetupPage() {
  const [savingPreferences, setSavingPreferences] = useState(false);
  const { preferences, preferenceError, updatePreferences } = useUserPreferences();
  const selectedRepositoryValues = preferences?.repositories ?? [];
  const navigate = useNavigate();
  const {
    setup,
    checking,
    connectingCodex,
    error,
    refresh,
    connectCodex,
  } = useSetupStatus();
  const githubConnected = setup?.github.state === "connected";
  const repositorySetup = useRepositories(githubConnected);
  const selectedRepositories = selectedRepositoryValues.map(
    (value) => repositorySetup.choices.find((repository) => repository.value === value)
      ?? { value, label: value, isPrivate: false },
  );

  useEffect(() => {
    if (!preferences || repositorySetup.choices.length === 0) {
      return;
    }
    const availableValues = new Set(repositorySetup.choices.map((repository) => repository.value));
    const validValues = preferences.repositories.filter((value) => availableValues.has(value));
    if (validValues.length === preferences.repositories.length) {
      return;
    }
    void updatePreferences({
      ...preferences,
      repositories: validValues,
      setupComplete: false,
    }).catch(() => undefined);
  }, [preferences, repositorySetup.choices, updatePreferences]);

  const selectRepositories = useCallback((repositories: GitHubRepositoryChoice[]) => {
    if (!preferences) {
      return;
    }
    const values = repositories.map((repository) => repository.value);
    void updatePreferences({
      ...preferences,
      repositories: values,
      setupComplete: false,
    }).catch(() => undefined);
  }, [preferences, updatePreferences]);
  const finishSetup = useCallback(async () => {
    if (!preferences) {
      return;
    }
    setSavingPreferences(true);
    try {
      await updatePreferences({
        ...preferences,
        setupComplete: true,
      });
      await navigate({ to: "/" });
    } catch {
      // The preferences hook reports the error.
    } finally {
      setSavingPreferences(false);
    }
  }, [navigate, preferences, updatePreferences]);
  const completedSteps = setup
    ? Number(setup.github.state === "connected")
      + Number(setup.codex.state === "connected")
      + Number(selectedRepositoryValues.length > 0)
    : 0;
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2.125rem)] w-full max-w-3xl flex-col justify-center gap-5 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto grid max-w-xl gap-3 text-center">
        <h1 className="text-balance text-2xl font-semibold">
          Get started with Review
        </h1>
      </div>
      <section
        aria-labelledby="setup-heading"
        className="mx-auto w-full max-w-xl rounded-xl bg-border-strong p-px shadow-[0_1px_2px_rgb(0_0_0_/_0.08),0_8px_24px_rgb(35_38_36_/_0.08)]"
      >
        <div className="relative overflow-hidden rounded-[calc(0.75rem-1px)] bg-panel px-4 py-3.5 text-text after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-[48%] after:bg-[radial-gradient(circle,rgb(0_0_0_/_0.075)_0.75px,transparent_0.9px)] after:bg-[size:7px_7px] after:content-[''] after:[mask-image:linear-gradient(to_right,transparent,black_38%,transparent_94%)] sm:px-5 sm:py-4 max-[30rem]:after:w-[72%] max-[30rem]:after:opacity-65">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <h2 id="setup-heading" className="text-xs font-medium text-text-secondary">
              Setup
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <span>{setup ? `${completedSteps}/3` : "Checking"}</span>
              <SetupProgress completedSteps={completedSteps} />
            </div>
          </div>
          <ol className="relative z-10 mt-2.5 grid gap-0.5">
            <GitHubStep
              status={setup?.github ?? null}
              checking={checking}
              refresh={refresh}
            />
            <CodexStep
              status={setup?.codex ?? null}
              checking={checking}
              connecting={connectingCodex}
              connect={connectCodex}
              refresh={refresh}
            />
            <RepositoryStep
              choices={repositorySetup.choices}
              selected={selectedRepositories}
              githubConnected={githubConnected}
              loading={repositorySetup.loading}
              error={repositorySetup.error}
              onChange={selectRepositories}
              retry={repositorySetup.refresh}
            />
          </ol>
          <div className="relative z-10 mt-3.5 flex justify-end border-t border-border pt-3.5">
            <Button
              size="lg"
              variant="default"
              disabled={!preferences || completedSteps < 3 || savingPreferences}
              onClick={finishSetup}
            >
              Get started
            </Button>
          </div>
        </div>
      </section>
      <p className="sr-only" role="status" aria-live="polite">
        {preferenceError ? (
          <>Unable to save your preferences. Try again.</>
        ) : error === "connect" ? (
          <>Unable to start Codex sign-in. Check that the Codex CLI is installed.</>
        ) : error === "status" ? (
          <>Unable to check setup. Try again.</>
        ) : connectingCodex ? (
          <>Opening ChatGPT sign-in in your browser.</>
        ) : checking || !setup ? (
          <>Checking your connections.</>
        ) : (
          <>{completedSteps} of 3 setup steps complete.</>
        )}
      </p>
    </main>
  );
}
