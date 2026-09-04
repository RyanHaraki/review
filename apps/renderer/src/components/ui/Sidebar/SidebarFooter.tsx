import type { ComponentProps } from "react";

import { sidebarClasses } from "./SidebarUtilities";

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={sidebarClasses("flex shrink-0 flex-col gap-2 border-t border-border p-3", className)}
      data-sidebar="footer"
      data-slot="sidebar-footer"
      {...props}
    />
  );
}
