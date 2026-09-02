import { Outlet, createRootRoute } from "@tanstack/react-router";

function AppShell() {
  return (
    <div className="min-h-screen bg-page text-text">
      <header className="flex h-8.5 items-center border-b border-border px-20 text-sm font-medium [-webkit-app-region:drag] select-none">
        Review
      </header>
      <Outlet />
    </div>
  );
}

export const Route = createRootRoute({ component: AppShell });
