import type { ComponentProps } from "react";

import { sidebarClasses } from "./SidebarUtilities";

export function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={sidebarClasses("min-w-0", className)}
      data-sidebar="group-content"
      data-slot="sidebar-group-content"
      {...props}
    />
  );
}
