import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "../../ui/sidebar";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { useCallback } from "react";
import {
  formatPullRequestTime,
  type PullRequestWorkspaceProps,
} from "./pull-request-workspace-types";
import { GithubIcon } from "../../icons/github-icon";

export function PullRequestWorkspace({
  filters,
  notice,
  onSelect,
  selectedPullRequest,
  statusGroups,
}: PullRequestWorkspaceProps) {
  const copyBranchName = useCallback((branchName: string) => {
    void navigator.clipboard.writeText(branchName).catch(() => undefined);
  }, []);
  const copyHeadBranch = useCallback(() => {
    if (selectedPullRequest) {
      copyBranchName(selectedPullRequest.headRefName);
    }
  }, [copyBranchName, selectedPullRequest]);
  const copyBaseBranch = useCallback(() => {
    if (selectedPullRequest) {
      copyBranchName(selectedPullRequest.baseRefName);
    }
  }, [copyBranchName, selectedPullRequest]);

  return (
    <SidebarProvider className="h-[calc(100vh-2.125rem)]" width="24rem">
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div>
            <h1 className="text-base font-semibold">Pull requests</h1>
          </div>
          {filters}
          {notice}
        </SidebarHeader>
        <SidebarContent>
          {statusGroups.map((group) => (
            <SidebarGroup key={group.value}>
              <SidebarGroupLabel className="justify-between">
                <span>{group.label}</span>
                <span className="font-normal tabular-nums">{group.pullRequests.length}</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.pullRequests.map((pullRequest) => (
                    <SidebarMenuItem key={pullRequest.githubId}>
                      <SidebarMenuButton
                        isActive={selectedPullRequest?.githubId === pullRequest.githubId}
                        onClick={() => onSelect(pullRequest)}
                        size="large"
                      >
                        <span className="size-2 shrink-0 rounded-full bg-status-complete" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{pullRequest.title}</span>
                          <span className="mt-0.5 block truncate text-xs font-normal text-text-secondary">
                            {pullRequest.repository} #{pullRequest.number}
                          </span>
                        </span>
                        <time className="shrink-0 self-start text-[0.6875rem] font-normal text-text-secondary" dateTime={pullRequest.updatedAt}>
                          {formatPullRequestTime(pullRequest.updatedAt)}
                        </time>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        {selectedPullRequest ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            <div className="w-full">
              <div className="flex items-center gap-1 text-sm text-text-secondary">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        render={
                          <a
                            href={`https://github.com/${selectedPullRequest.repository}`}
                            rel="noreferrer"
                            target="_blank"
                          />
                        }
                        size="sm"
                        variant="ghost"
                      />
                    }
                  >
                    {selectedPullRequest.repository}
                  </TooltipTrigger>
                  <TooltipContent>Open repo in browser</TooltipContent>
                </Tooltip>
                <span>#{selectedPullRequest.number}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-[-0.02em]">
                  {selectedPullRequest.title}
                </h2>
                <Button
                  nativeButton={false}
                  render={<a href={selectedPullRequest.url} rel="noreferrer" target="_blank" />}
                  variant="outline"
                >
                  <GithubIcon className="size-4" />
                  Open in GitHub
                </Button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-4 overflow-x-auto whitespace-nowrap text-sm text-text-secondary">
                <div className="flex shrink-0 items-center gap-2">
                  <Avatar className="size-6" size="sm">
                    <AvatarImage alt="" src={selectedPullRequest.authorAvatarUrl ?? undefined} />
                    <AvatarFallback aria-hidden="true">
                      {selectedPullRequest.authorLogin.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{selectedPullRequest.authorLogin}</span>
                  <div className="flex shrink-0 items-center gap-1 font-mono">
                    <Tooltip>
                      <TooltipTrigger
                        render={<Button onClick={copyHeadBranch} size="sm" variant="text" />}
                      >
                        {selectedPullRequest.headRefName}
                      </TooltipTrigger>
                      <TooltipContent>Copy branch name</TooltipContent>
                    </Tooltip>
                    <span aria-hidden="true">&rarr;</span>
                    <Tooltip>
                      <TooltipTrigger
                        render={<Button onClick={copyBaseBranch} size="sm" variant="text" />}
                      >
                        {selectedPullRequest.baseRefName}
                      </TooltipTrigger>
                      <TooltipContent>Copy branch name</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">
                    {selectedPullRequest.changedFiles.toLocaleString()} {selectedPullRequest.changedFiles === 1 ? "file" : "files"} changed
                  </span>
                  <span className="tabular-nums">
                    <span className="text-[#1a7f37]">+{selectedPullRequest.additions.toLocaleString()}</span>{" "}
                    <span className="text-[#cf222e]">-{selectedPullRequest.deletions.toLocaleString()}</span>
                  </span>
                  <time className="ml-2" dateTime={selectedPullRequest.updatedAt}>
                    Updated {formatPullRequestTime(selectedPullRequest.updatedAt)}
                  </time>
                </div>
              </div>
              <section className="mt-6 min-h-80 w-full rounded-xl border border-border bg-surface p-6">
                <h3 className="text-sm font-semibold">Review</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Review content, changed files, and discussion will appear in this pane.
                </p>
              </section>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <h2 className="text-base font-semibold">No pull request selected</h2>
              <p className="mt-1 text-sm text-text-secondary">Choose one from the sidebar.</p>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
