import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={sidebarClasses("relative min-w-0", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}
