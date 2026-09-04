import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={sidebarClasses("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain", className)}
      data-sidebar="content"
      data-slot="sidebar-content"
      {...props}
    />
  );
}
