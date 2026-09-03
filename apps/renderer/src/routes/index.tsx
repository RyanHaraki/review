import { createRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/mini";

import { PullRequestsPage } from "../pages/pull-requests";
import type { PrototypeVariant } from "../components/pull-requests/Prototype/PrototypeSwitcher";
import { readPreferences } from "../pages/setup/setup-persistence";
import { Route as RootRoute } from "./root";

type PrototypeSearch = {
  variant: PrototypeVariant;
};

const prototypeSearchSchema = z.object({
  variant: z.optional(z.enum(["A", "B", "C"])),
});
type PrototypeSearchInput = z.input<typeof prototypeSearchSchema>;

function readPrototypeVariant(search: PrototypeSearchInput): PrototypeSearch {
  const result = prototypeSearchSchema.safeParse(search);
  return { variant: result.success ? result.data.variant ?? "A" : "A" };
}

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  validateSearch: readPrototypeVariant,
  beforeLoad: async () => {
    const preferences = await readPreferences();
    if (!preferences.setupComplete || preferences.repositories.length === 0) {
      throw redirect({ to: "/setup" });
    }
  },
  component: PullRequestsRoute,
});

function PullRequestsRoute() {
  const { variant } = Route.useSearch();
  return <PullRequestsPage variant={variant} />;
}
