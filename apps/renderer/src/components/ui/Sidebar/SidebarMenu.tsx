import type { ComponentProps } from "react";

import { sidebarClasses } from "./SidebarUtilities";

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={sidebarClasses("flex min-w-0 flex-col gap-0.5 px-2", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}
