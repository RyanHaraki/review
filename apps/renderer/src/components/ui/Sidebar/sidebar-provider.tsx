import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";

import { SidebarContext } from "./sidebar-context";
import { sidebarClasses } from "./sidebar-utilities";

type SidebarStyle = CSSProperties & {
  "--sidebar-width": string;
};

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
        className={sidebarClasses("group/sidebar-wrapper flex min-h-0 w-full flex-1", className)}
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
