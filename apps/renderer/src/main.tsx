import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";

import { SessionApplication } from "./session/session-application";
import { githubSession } from "./session/github-session-store";
import { configureQueryFocusManager } from "./query/query-focus-manager";
import { TooltipProvider } from "./components/ui/tooltip";
import "./index.css";

if (import.meta.env.DEV) {
  void import("react-grab");
}

configureQueryFocusManager();
void githubSession.initialize();

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
      <TooltipProvider>
        <SessionApplication />
      </TooltipProvider>
    </IconContext.Provider>
  </StrictMode>,
);
