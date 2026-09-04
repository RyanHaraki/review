import type { ComponentProps } from "react";

import { sidebarClasses } from "./sidebar-utilities";
import { useSidebar } from "./use-sidebar";

export function Sidebar({
  children,
  className,
  collapsible = "offcanvas",
  variant = "sidebar",
  ...props
}: ComponentProps<"aside"> & {
  collapsible?: "offcanvas" | "none";
  variant?: "sidebar" | "floating" | "inset";
}) {
  const { open } = useSidebar();
  const canCollapse = collapsible === "offcanvas";

  return (
    <aside
      aria-label="Pull requests"
      className={sidebarClasses(
        "relative z-10 min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-linear",
        canCollapse && !open ? "w-0" : "w-(--sidebar-width)",
        variant === "floating" || variant === "inset" ? "bg-page p-2 pe-0" : "border-e border-border bg-panel",
        className,
      )}
      data-collapsible={canCollapse && !open ? "offcanvas" : ""}
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      data-variant={variant}
      inert={canCollapse && !open ? true : undefined}
      {...props}
    >
      <div
        className={sidebarClasses(
          "flex h-full w-(--sidebar-width) flex-col overflow-hidden bg-panel text-text",
          variant === "floating" || variant === "inset"
            ? "rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]"
            : "",
        )}
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
      >
        {children}
      </div>
    </aside>
  );
}
