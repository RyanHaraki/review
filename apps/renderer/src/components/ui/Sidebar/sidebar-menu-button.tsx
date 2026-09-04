import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";

export function SidebarMenuButton({
  children,
  className,
  isActive = false,
  size = "default",
  ...props
}: ComponentProps<"button"> & {
  isActive?: boolean;
  size?: "compact" | "default" | "large";
}) {
  const sizeClass = size === "compact"
    ? "min-h-9 px-2.5 py-1.5"
    : size === "large"
      ? "min-h-15 px-3 py-2.5"
      : "min-h-11 px-3 py-2";

  return (
    <button
      className={sidebarClasses(
        "flex w-full min-w-0 items-center gap-2 rounded-lg text-start text-sm outline-none transition-[background-color,color] duration-100 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
        isActive && "bg-surface-selected font-medium",
        sizeClass,
        className,
      )}
      data-active={isActive || undefined}
      data-sidebar="menu-button"
      data-slot="sidebar-menu-button"
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
