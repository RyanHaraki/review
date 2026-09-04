import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={sidebarClasses("flex shrink-0 flex-col gap-3 border-b border-border p-4", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}
