import type { ComponentProps } from "react";

import { Button } from "../button";
import { useSidebar } from "./UseSidebar";

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
