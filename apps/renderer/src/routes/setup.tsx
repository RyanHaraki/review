import { createRoute } from "@tanstack/react-router";

import { SetupPage } from "../pages/setup";
import { Route as RootRoute } from "./root";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/setup",
  component: SetupPage,
});
