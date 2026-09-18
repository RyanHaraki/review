import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { SetupIcon } from "./setup-icon";
import { useGitHubSession } from "../../session/use-github-session";

export function GitHubStep() {
  const { status } = useGitHubSession();
  const [copied, setCopied] = useState(false);
  const action = useMutation({ mutationFn: async (kind: "sign-in" | "cancel" | "sign-out" | "copy") => {
    switch (kind) {
      case "sign-in": await window.reviewDesktop.signInGitHub(); break;
      case "cancel": await window.reviewDesktop.cancelGitHubSignIn(); break;
      case "sign-out": await window.reviewDesktop.signOutGitHub(); break;
      case "copy":
        if (status?.state === "authorizing") {
          await navigator.clipboard.writeText(status.userCode);
          setCopied(true);
        }
        break;
    }
  } });
  const { mutate } = action;
  const signIn = useCallback(() => { setCopied(false); mutate("sign-in"); }, [mutate]);
  const cancel = useCallback(() => mutate("cancel"), [mutate]);
  const signOut = useCallback(() => mutate("sign-out"), [mutate]);
  const copy = useCallback(() => mutate("copy"), [mutate]);
  const connected = status?.state === "connected";
  return (
    <li className="grid gap-2 rounded-lg border border-transparent px-1 py-2 sm:px-2">
      <div className="flex items-start gap-2.5">
        <SetupIcon complete={connected} step={1} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">GitHub</p>
          <p className="text-xs leading-4 text-text-secondary">
            {connected ? `Signed in as @${status.account.login}` : status?.state === "authorizing"
              ? "Enter this code on GitHub to finish signing in."
              : "Sign in to review your repositories."}
          </p>
        </div>
        {connected && <Button variant="outline" size="sm" disabled={action.isPending} onClick={signOut}>Sign out</Button>}
      </div>
      <div className="ms-9 grid gap-2">
        {status?.state === "authorizing" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border-strong bg-surface px-3 py-2 text-base tracking-widest">{status.userCode}</code>
              <Button size="sm" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy code"}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" nativeButton={false} render={<a href={status.verificationUri} target="_blank" rel="noreferrer" />}>Open GitHub</Button>
              <Button size="sm" variant="outline" onClick={cancel}>Cancel sign-in</Button>
            </div>
          </>
        ) : !connected && (
          <Button className="w-fit" size="sm" disabled={!status || status.state === "unavailable" || action.isPending} onClick={signIn}>
            {action.isPending ? "Starting sign-in…" : "Sign in with GitHub"}
          </Button>
        )}
        {(status?.state === "unavailable" || status?.state === "disconnected") && status.message && <p role="alert" className="text-xs text-red-700">{status.message}</p>}
        {action.error && <p role="alert" className="text-xs text-red-700">{action.error.message}</p>}
      </div>
    </li>
  );
}
