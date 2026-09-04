import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "./Query/query-client";
import { configureQueryFocusManager } from "./Query/query-focus-manager";
import { router } from "./router";
import "./index.css";

configureQueryFocusManager();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Unable to find the application root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
