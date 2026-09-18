import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { SetupIcon } from "./setup-icon";

type InstallationStepProps = {
  githubConnected: boolean;
  complete: boolean;
  loading: boolean;
  error: boolean;
  refresh(): Promise<void>;
};

export function InstallationStep({ githubConnected, complete, loading, error, refresh }: InstallationStepProps) {
  const installation = useMutation({ mutationFn: () => window.reviewDesktop.openGitHubInstallations() });
  const { mutate } = installation;
  const install = useCallback(() => mutate(), [mutate]);
  return (
    <li className="grid gap-2 rounded-lg border border-transparent px-1 py-2 sm:px-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <SetupIcon complete={complete} step={3} />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text">Install the GitHub app</span>
          <span className="text-xs leading-4 text-text-secondary">
            {!githubConnected ? "Sign in to GitHub first." : loading ? "Checking repository access." : error
              ? "Unable to check access. Try again." : complete ? "Review has access to your repositories."
                : "Install Review in your organization or personal account and grant repository access."}
          </span>
        </div>
      </div>
      {githubConnected && (
        <div className="ms-9 grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={complete ? "outline" : "default"} onClick={install} disabled={installation.isPending}>
              {complete ? "Manage installation" : "Install on GitHub"}
            </Button>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>Check access</Button>
          </div>
          {!complete && <p className="text-xs text-text-secondary">Your organization may require an owner's approval. After installation, return here to continue.</p>}
          {installation.error && <p role="alert" className="text-xs text-red-700">{installation.error.message}</p>}
        </div>
      )}
    </li>
  );
}
