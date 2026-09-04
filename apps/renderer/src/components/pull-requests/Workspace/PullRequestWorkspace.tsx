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
  SidebarTrigger,
} from "../../ui/Sidebar";
import { Button } from "../../ui/button";
import {
  formatPullRequestTime,
  getReviewStateLabel,
  type PullRequestWorkspaceProps,
} from "./PullRequestWorkspaceTypes";

export function PullRequestWorkspace({
  filters,
  notice,
  onSelect,
  _pullRequestCount,
  _repositoryCount,
  selectedPullRequest,
  statusGroups,
}: PullRequestWorkspaceProps) {
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
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
          <SidebarTrigger />
          <span className="text-sm font-medium text-text-secondary">Review workspace</span>
        </header>
        {selectedPullRequest ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-medium text-text-secondary">
                {selectedPullRequest.repository} #{selectedPullRequest.number}
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <h2 className="max-w-2xl text-2xl font-semibold tracking-[-0.02em]">
                  {selectedPullRequest.title}
                </h2>
                <Button
                  nativeButton={false}
                  render={<a href={selectedPullRequest.url} rel="noreferrer" target="_blank" />}
                  variant="outline"
                >
                  Open in GitHub
                </Button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-text-secondary">Author</p>
                  <p className="mt-1 text-sm font-medium">{selectedPullRequest.authorLogin}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-text-secondary">Review state</p>
                  <p className="mt-1 text-sm font-medium">{getReviewStateLabel(selectedPullRequest)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-text-secondary">Changes</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    <span className="text-[#1a7f37]">+{selectedPullRequest.additions.toLocaleString()}</span>{" "}
                    <span className="text-[#cf222e]">-{selectedPullRequest.deletions.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <section className="mt-6 min-h-80 rounded-xl border border-border bg-surface p-6">
                <h3 className="text-sm font-semibold">Review</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">
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
