import { createRoute, redirect } from "@tanstack/react-router";

import { PullRequestsPage } from "../pages/pull-requests";
import { readPreferences } from "../pages/setup/setup-persistence";
import { githubSession } from "../session/github-session-store";
import { Route as RootRoute } from "./root";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  beforeLoad: async () => {
    if (githubSession.getSnapshot().status?.state !== "connected") {
      throw redirect({ to: "/setup" });
    }
    const preferences = await readPreferences();
    if (!preferences.setupComplete || preferences.repositories.length === 0) {
      throw redirect({ to: "/setup" });
    }
  },
  component: PullRequestsPage,
});
