import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarGroup({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={sidebarClasses("flex min-w-0 flex-col py-2", className)}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}
