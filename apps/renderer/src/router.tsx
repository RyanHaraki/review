import { createHashHistory } from "@tanstack/history";
import { createRouter } from "@tanstack/react-router";

import { Route as IndexRoute } from "./routes/index";
import { Route as RootRoute } from "./routes/root";
import { Route as SetupRoute } from "./routes/setup";

const routeTree = RootRoute.addChildren([IndexRoute, SetupRoute]);

export function createAppRouter() {
  return createRouter({
  routeTree,
  history: createHashHistory(),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
