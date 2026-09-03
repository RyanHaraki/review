import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

export function ReviewInboxVariant({
  filters,
  notice,
  onSelect,
  pullRequestCount,
  selectedPullRequest,
  statusGroups,
}: PullRequestPrototypeProps) {
  return (
    <SidebarProvider className="h-[calc(100vh-2.125rem)]" width="28rem">
      <Sidebar collapsible="offcanvas" variant="floating">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Inbox</p>
              <h1 className="mt-0.5 text-lg font-semibold">{pullRequestCount} pull requests</h1>
            </div>
          </div>
          {filters}
          {notice}
        </SidebarHeader>
        <SidebarContent className="gap-2 p-2">
          {statusGroups.map((group) => (
            <SidebarGroup className="rounded-lg border border-border bg-surface py-2" key={group.value}>
              <SidebarGroupLabel className="justify-between px-3">
                <span>{group.label}</span>
                <span className="rounded-md bg-panel px-1.5 py-0.5 font-normal tabular-nums">
                  {group.pullRequests.length}
                </span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="px-1.5">
                  {group.pullRequests.map((pullRequest) => (
                    <SidebarMenuItem key={pullRequest.githubId}>
                      <SidebarMenuButton
                        className="items-start"
                        isActive={selectedPullRequest?.githubId === pullRequest.githubId}
                        onClick={() => onSelect(pullRequest)}
                        size="large"
                      >
                        {pullRequest.authorAvatarUrl ? (
                          <img
                            alt=""
                            className="mt-0.5 size-7 shrink-0 rounded-full object-cover ring-1 ring-black/10"
                            height="28"
                            src={pullRequest.authorAvatarUrl}
                            width="28"
                          />
                        ) : (
                          <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-panel text-xs">
                            {pullRequest.authorLogin.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{pullRequest.title}</span>
                          <span className="mt-1 flex items-center justify-between gap-2 text-[0.6875rem] font-normal text-text-secondary">
                            <span className="truncate">{pullRequest.repository} #{pullRequest.number}</span>
                            <time className="shrink-0" dateTime={pullRequest.updatedAt}>{formatPullRequestTime(pullRequest.updatedAt)}</time>
                          </span>
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="bg-surface">
          <p className="text-xs text-text-secondary">Use ⌘B to toggle this sidebar.</p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-surface">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-5">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedPullRequest?.title ?? "Review"}</p>
            {selectedPullRequest && (
              <p className="truncate text-xs text-text-secondary">
                {selectedPullRequest.repository} #{selectedPullRequest.number}
              </p>
            )}
          </div>
          {selectedPullRequest && (
            <a
              className="shrink-0 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
              href={selectedPullRequest.url}
              rel="noreferrer"
              target="_blank"
            >
              View pull request
            </a>
          )}
        </header>
        {selectedPullRequest ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="rounded-full border border-border px-2 py-1 capitalize">{selectedPullRequest.status}</span>
                <span className="rounded-full border border-border px-2 py-1">{getReviewStateLabel(selectedPullRequest)}</span>
                <span>{selectedPullRequest.headRefName}</span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em]">{selectedPullRequest.title}</h2>
              <p className="mt-3 text-sm text-text-secondary">
                Opened by {selectedPullRequest.authorLogin}. Updated {formatPullRequestTime(selectedPullRequest.updatedAt)}.
              </p>
              <div className="mt-8 grid min-h-96 grid-cols-[minmax(0,1fr)_12rem] overflow-hidden rounded-xl border border-border">
                <section className="bg-page p-6">
                  <h3 className="text-sm font-semibold">Files and review</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    The file diff and review guide can fill this main column.
                  </p>
                </section>
                <aside className="border-s border-border bg-surface p-4" aria-label="Pull request summary">
                  <p className="text-xs font-medium text-text-secondary">Summary</p>
                  <dl className="mt-4 grid gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-text-tertiary">Additions</dt>
                      <dd className="mt-1 font-medium text-[#1a7f37]">+{selectedPullRequest.additions.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-tertiary">Deletions</dt>
                      <dd className="mt-1 font-medium text-[#cf222e]">-{selectedPullRequest.deletions.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-tertiary">Author</dt>
                      <dd className="mt-1 truncate font-medium">{selectedPullRequest.authorLogin}</dd>
                    </div>
                  </dl>
                </aside>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <h2 className="text-base font-semibold">Your review pane is ready</h2>
              <p className="mt-1 text-sm text-text-secondary">Choose a pull request from the inbox.</p>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
