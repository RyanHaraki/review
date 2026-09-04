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

const skeletonRows = [0, 1, 2, 3];

export function PullRequestWorkspaceSkeleton() {
  return (
    <SidebarProvider
      aria-label="Loading pull requests"
      className="h-[calc(100vh-2.125rem)]"
      role="status"
      width="24rem"
    >
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div className="h-5 w-28 animate-pulse rounded bg-surface-selected" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-36 animate-pulse rounded-md bg-surface-selected" />
            <div className="h-8 w-36 animate-pulse rounded-md bg-surface-selected" />
            <div className="h-8 w-20 animate-pulse rounded-md bg-surface-selected" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          {["Pull requests", "In review"].map((group) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel className="justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-selected" />
                <div className="h-3 w-4 animate-pulse rounded bg-surface-selected" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {skeletonRows.map((row) => (
                    <SidebarMenuItem key={row}>
                      <SidebarMenuButton aria-hidden="true" size="large">
                        <span className="size-2 shrink-0 rounded-full bg-surface-selected" />
                        <span className="min-w-0 flex-1 space-y-1.5">
                          <span className="block h-3.5 w-4/5 animate-pulse rounded bg-surface-selected" />
                          <span className="block h-3 w-2/5 animate-pulse rounded bg-surface-selected" />
                        </span>
                        <span className="h-3 w-8 shrink-0 animate-pulse rounded bg-surface-selected" />
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
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="w-full">
            <div className="h-3 w-32 animate-pulse rounded bg-surface-selected" />
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-surface-selected" />
              <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-surface-selected" />
            </div>
            <div className="mt-4 flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-3 w-2 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-4 w-48 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-3 w-2 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-3 w-2 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-4 w-24 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-3 w-2 shrink-0 animate-pulse rounded bg-surface-selected" />
              <div className="h-4 w-24 shrink-0 animate-pulse rounded bg-surface-selected" />
            </div>
            <div className="mt-6 min-h-80 w-full rounded-xl border border-border bg-surface p-6">
              <div className="h-4 w-12 animate-pulse rounded bg-surface-selected" />
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface-selected" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-surface-selected" />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
