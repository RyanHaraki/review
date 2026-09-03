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
import {
  formatPullRequestTime,
  getReviewStateLabel,
  type PullRequestPrototypeProps,
} from "./PullRequestPrototypeTypes";

export function CompactQueueVariant({
  filters,
  notice,
  onSelect,
  pullRequestCount,
  selectedPullRequest,
  statusGroups,
}: PullRequestPrototypeProps) {
  return (
    <SidebarProvider className="h-[calc(100vh-2.125rem)] bg-page" width="20rem">
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-semibold">Review queue</h1>
              <p className="text-xs text-text-secondary">{pullRequestCount} pull requests</p>
            </div>
          </div>
          {filters}
          {notice}
        </SidebarHeader>
        <SidebarContent className="pb-3">
          {statusGroups.map((group) => (
            <SidebarGroup className="py-1" key={group.value}>
              <SidebarGroupLabel className="min-h-7 px-3 text-[0.6875rem] uppercase tracking-[0.08em]">
                {group.label} · {group.pullRequests.length}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="px-1.5">
                  {group.pullRequests.map((pullRequest) => (
                    <SidebarMenuItem key={pullRequest.githubId}>
                      <SidebarMenuButton
                        className="gap-2"
                        isActive={selectedPullRequest?.githubId === pullRequest.githubId}
                        onClick={() => onSelect(pullRequest)}
                        size="compact"
                      >
                        <span className="min-w-0 flex-1 truncate">{pullRequest.title}</span>
                        <time className="shrink-0 text-[0.6875rem] font-normal text-text-tertiary" dateTime={pullRequest.updatedAt}>
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
      <SidebarInset className="m-2 ms-0 rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <span className="truncate text-sm font-medium">
              {selectedPullRequest?.title ?? "Review workspace"}
            </span>
          </div>
          {selectedPullRequest && (
            <span className="shrink-0 rounded-full bg-panel px-2 py-1 text-xs text-text-secondary">
              {getReviewStateLabel(selectedPullRequest)}
            </span>
          )}
        </header>
        {selectedPullRequest ? (
          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
            <div className="grid gap-px border-b border-border bg-border sm:grid-cols-4">
              <div className="bg-surface px-5 py-4">
                <p className="text-[0.6875rem] text-text-tertiary">Repository</p>
                <p className="mt-1 truncate text-sm">{selectedPullRequest.repository}</p>
              </div>
              <div className="bg-surface px-5 py-4">
                <p className="text-[0.6875rem] text-text-tertiary">Branch</p>
                <p className="mt-1 truncate text-sm">{selectedPullRequest.headRefName}</p>
              </div>
              <div className="bg-surface px-5 py-4">
                <p className="text-[0.6875rem] text-text-tertiary">Author</p>
                <p className="mt-1 truncate text-sm">{selectedPullRequest.authorLogin}</p>
              </div>
              <div className="bg-surface px-5 py-4">
                <p className="text-[0.6875rem] text-text-tertiary">Diff</p>
                <p className="mt-1 text-sm tabular-nums">
                  <span className="text-[#1a7f37]">+{selectedPullRequest.additions.toLocaleString()}</span>{" "}
                  <span className="text-[#cf222e]">-{selectedPullRequest.deletions.toLocaleString()}</span>
                </p>
              </div>
            </div>
            <div className="grid place-items-center bg-page/60 p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-surface text-text-secondary">
                  <span aria-hidden="true" className="text-lg">⌘</span>
                </div>
                <h2 className="mt-4 text-base font-semibold">Review canvas</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  This compact option gives the review more horizontal space and keeps the queue dense.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-text-secondary">Select a pull request.</div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
