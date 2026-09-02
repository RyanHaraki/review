import { createRoute, redirect } from "@tanstack/react-router";

import { PullRequestsPage } from "../pages/pull-requests";
import { isSetupComplete, readPreferences } from "../pages/setup/setup-persistence";
import { Route as RootRoute } from "./root";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  beforeLoad: () => {
    const preferences = readPreferences();
    if (!isSetupComplete() || !preferences || preferences.repositories.length === 0) {
      throw redirect({ to: "/setup" });
    }
  },
  component: PullRequestsPage,
});
