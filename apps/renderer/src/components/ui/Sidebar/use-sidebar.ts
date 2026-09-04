import { useContext } from "react";

import { SidebarContext, type SidebarContextValue } from "./sidebar-context";

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}
