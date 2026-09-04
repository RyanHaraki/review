import type { PullRequestWorkspaceProps } from "./pull-request-workspace-types";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "../../ui/sidebar";
import { formatPullRequestTime } from "./pull-request-workspace-types";

type PullRequestSidebarProps = Pick<
  PullRequestWorkspaceProps,
  "filters" | "notice" | "onSelect" | "selectedPullRequest" | "statusGroups"
>;

export function PullRequestSidebar({
  filters,
  notice,
  onSelect,
  selectedPullRequest,
  statusGroups,
}: PullRequestSidebarProps) {
  return (
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
                      <time
                        className="shrink-0 self-start text-[0.6875rem] font-normal text-text-secondary"
                        dateTime={pullRequest.updatedAt}
                      >
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
  );
}
