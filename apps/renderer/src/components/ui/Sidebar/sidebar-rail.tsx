import type { ComponentProps } from "react";

import { useSidebar } from "./use-sidebar";

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
