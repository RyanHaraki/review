import type { CodexSetupStatus, GitHubSetupStatus } from "@review/contracts";

import { Button } from "../ui/button";

const rowClassName =
  "flex flex-col gap-2 rounded-lg border border-transparent px-1 py-2 [@media(hover:hover)]:has-[button:not(:disabled)]:hover:border-black/8 [@media(hover:hover)]:has-[button:not(:disabled)]:hover:bg-black/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-2";
const actionClassName =
  "min-h-8 shrink-0 self-start rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,scale] duration-100 active:scale-[0.96] disabled:cursor-wait disabled:opacity-55 [@media(hover:hover)]:not-disabled:hover:bg-[#333331] sm:self-auto";

type SetupIconProps = {
  complete: boolean;
  step: 1 | 2 | 3;
};

function SetupIcon({ complete, step }: SetupIconProps) {
  if (!complete) {
    return (
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[0.6875rem] font-[650] text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.16)]"
        aria-hidden="true"
      >
        <span>{step}</span>
      </span>
    );
  }

  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full border border-black/12 bg-black/[0.055] text-[0.6875rem] font-[650] text-black/[0.62]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
        <path d="m5 10.5 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type GitHubStepProps = {
  status: GitHubSetupStatus | null;
  checking: boolean;
  refresh(): Promise<void>;
};

export function GitHubStep({ status, checking, refresh }: GitHubStepProps) {
  const connected = status?.state === "connected";
  const detail = status === null
    ? <>Checking your authenticated <code>gh</code> session.</>
    : status.state === "connected"
      ? status.login
        ? <>Connected as <span className="font-medium">@{status.login}</span></>
        : <>Connected to GitHub.</>
      : status.state === "unavailable"
        ? <>Review could not find the GitHub CLI on your <code>PATH</code>.</>
        : <>Run <code>gh auth login</code> in Terminal, then check again.</>;

  return (
    <li className={rowClassName}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SetupIcon complete={connected} step={1} />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text">GitHub CLI</span>
          <span className="text-xs leading-4 text-text-secondary">{detail}</span>
        </div>
      </div>
      {!connected && (
        <Button className={actionClassName} disabled={checking} onClick={refresh}>
          {checking ? "Checking" : "Check again"}
        </Button>
      )}
    </li>
  );
}

type CodexStepProps = {
  status: CodexSetupStatus | null;
  checking: boolean;
  connecting: boolean;
  connect(): Promise<void>;
  refresh(): Promise<void>;
};

export function CodexStep({ status, checking, connecting, connect, refresh }: CodexStepProps) {
  const connected = status?.state === "connected";
  const unavailable = status?.state === "unavailable";
  const detail = status === null
    ? <>Checking your local Codex session.</>
    : status.state === "unavailable"
      ? <>Review could not start Codex. Install or update the Codex CLI.</>
      : status.state === "disconnected"
        ? <>Sign in with ChatGPT to use your Codex subscription.</>
        : status.account?.type === "chatgpt"
          ? <>{status.account.email ?? "Connected with ChatGPT"}<span aria-hidden="true"> · </span><span className="font-medium">{status.account.plan}</span></>
          : status.account?.type === "apiKey"
            ? <>Connected with an OpenAI API key.</>
            : status.account?.type === "amazonBedrock"
              ? <>Connected with Amazon Bedrock.</>
              : <>Connected to Codex.</>;

  return (
    <li className={rowClassName}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SetupIcon complete={connected} step={2} />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text">Codex</span>
          <span className="text-xs leading-4 text-text-secondary">{detail}</span>
        </div>
      </div>
      {!connected && (
        <Button className={actionClassName} disabled={checking || connecting} onClick={unavailable ? refresh : connect}>
          {connecting ? "Waiting for sign-in" : unavailable ? "Check again" : "Connect Codex"}
        </Button>
      )}
    </li>
  );
}
