import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";

import { Button } from "./button";

type SidebarContextValue = {
  open: boolean;
  setOpen(open: boolean): void;
  toggleSidebar(): void;
};

type SidebarStyle = CSSProperties & {
  "--sidebar-width": string;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}

export function SidebarProvider({
  children,
  className,
  defaultOpen = true,
  style,
  width = "22rem",
  ...props
}: ComponentProps<"div"> & { defaultOpen?: boolean; width?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleSidebar = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const value = useMemo(
    () => ({ open, setOpen, toggleSidebar }),
    [open, toggleSidebar],
  );
  const sidebarStyle: SidebarStyle = {
    "--sidebar-width": width,
    ...style,
  };

  return (
    <SidebarContext.Provider value={value}>
      <div
        className={classes("group/sidebar-wrapper flex min-h-0 w-full flex-1", className)}
        data-open={open}
        data-slot="sidebar-wrapper"
        style={sidebarStyle}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

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
      className={classes(
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
        className={classes(
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

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={classes("flex shrink-0 flex-col gap-3 border-b border-border p-4", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={classes("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain", className)}
      data-sidebar="content"
      data-slot="sidebar-content"
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={classes("flex shrink-0 flex-col gap-2 border-t border-border p-3", className)}
      data-sidebar="footer"
      data-slot="sidebar-footer"
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={classes("flex min-w-0 flex-col py-2", className)}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}

export function SidebarGroupLabel({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={classes("flex min-h-8 items-center px-4 text-xs font-semibold text-text-secondary", className)}
      data-sidebar="group-label"
      data-slot="sidebar-group-label"
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={classes("min-w-0", className)}
      data-sidebar="group-content"
      data-slot="sidebar-group-content"
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={classes("flex min-w-0 flex-col gap-0.5 px-2", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={classes("relative min-w-0", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}

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
      className={classes(
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

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={classes("relative flex min-w-0 flex-1 flex-col overflow-hidden bg-page", className)}
      data-slot="sidebar-inset"
      {...props}
    />
  );
}

export function SidebarTrigger({ className, ...props }: ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      aria-keyshortcuts="Meta+B Control+B"
      aria-label="Toggle pull request sidebar"
      className={className}
      onClick={toggleSidebar}
      size="icon-sm"
      title="Toggle pull request sidebar"
      variant="ghost"
      {...props}
    >
      <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
        <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.5" width="13" x="1.5" y="2" />
        <path d="M5.5 2v12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </Button>
  );
}

export function SidebarRail(props: ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      aria-label="Toggle pull request sidebar"
      className="absolute inset-y-0 end-[-0.5rem] z-20 hidden w-4 cursor-col-resize after:absolute after:inset-y-0 after:start-1/2 after:w-px hover:after:bg-border-strong sm:block"
      onClick={toggleSidebar}
      tabIndex={-1}
      title="Toggle pull request sidebar"
      type="button"
      {...props}
    />
  );
}
