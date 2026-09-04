import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "./query/query-client";
import { configureQueryFocusManager } from "./query/query-focus-manager";
import { router } from "./router";
import { TooltipProvider } from "./components/ui/tooltip";
import "./index.css";

if (import.meta.env.DEV) {
  void import("react-grab");
}

configureQueryFocusManager();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Unable to find the application root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <IconContext.Provider
      value={{
        color: "currentColor",
        size: "1em",
        weight: "regular",
        mirrored: false,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </IconContext.Provider>
  </StrictMode>,
);
