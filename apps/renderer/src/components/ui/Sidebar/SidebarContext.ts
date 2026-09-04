import { createContext } from "react";

export type SidebarContextValue = {
  open: boolean;
  setOpen(open: boolean): void;
  toggleSidebar(): void;
};

export const SidebarContext = createContext<SidebarContextValue | null>(null);
