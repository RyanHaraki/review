import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarGroupLabel({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={sidebarClasses("flex min-h-8 items-center px-4 text-xs font-semibold text-text-secondary", className)}
      data-sidebar="group-label"
      data-slot="sidebar-group-label"
      {...props}
    />
  );
}
