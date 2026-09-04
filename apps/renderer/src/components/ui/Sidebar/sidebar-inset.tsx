import type { ComponentProps } from "react";

import { sidebarClasses } from "./SidebarUtilities";

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={sidebarClasses("relative flex min-w-0 flex-1 flex-col overflow-hidden bg-page", className)}
      data-slot="sidebar-inset"
      {...props}
    />
  );
}
