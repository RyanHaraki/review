import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";
import type { ComponentProps } from "react";

export const DropdownMenu = DropdownMenuPrimitive.Root;

export function DropdownMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      className={[
        "[-webkit-app-region:no-drag] inline-flex h-7 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 text-[0.8rem] font-medium text-text outline-none transition-[background-color,border-color,color,opacity,scale,transform] duration-100 active:scale-[0.96] [@media(hover:hover)]:hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50",
        className,
      ].filter(Boolean).join(" ")}
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

type DropdownMenuContentProps = ComponentProps<typeof DropdownMenuPrimitive.Popup> &
  Pick<ComponentProps<typeof DropdownMenuPrimitive.Positioner>, "align" | "alignOffset" | "side" | "sideOffset">;

export function DropdownMenuContent({
  align = "end",
  alignOffset = 0,
  className,
  side = "bottom",
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner align={align} alignOffset={alignOffset} className="isolate z-50" side={side} sideOffset={sideOffset}>
        <DropdownMenuPrimitive.Popup
          className={[
            "min-w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-strong bg-surface p-1 text-text shadow-[0_18px_48px_rgb(35_38_36_/_0.16)] outline-none [color-scheme:light] transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className,
          ].filter(Boolean).join(" ")}
          data-slot="dropdown-menu-content"
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={[
        "flex min-h-9 w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[highlighted]:bg-surface-hover [@media(hover:hover)]:hover:bg-surface-hover",
        className,
      ].filter(Boolean).join(" ")}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    />
  );
}

export const DropdownMenuSub = DropdownMenuPrimitive.SubmenuRoot;

export function DropdownMenuSubTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubmenuTrigger>) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      className={[
        "flex min-h-9 w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-surface-hover [@media(hover:hover)]:hover:bg-surface-hover",
        className,
      ].filter(Boolean).join(" ")}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <svg aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" fill="none" viewBox="0 0 16 16">
        <path d="m6 3 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </DropdownMenuPrimitive.SubmenuTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Popup>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner className="isolate z-50" side="inline-end" sideOffset={4}>
        <DropdownMenuPrimitive.Popup
          className={[
            "min-w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-strong bg-surface p-1 text-text shadow-[0_18px_48px_rgb(35_38_36_/_0.16)] outline-none [color-scheme:light] transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className,
          ].filter(Boolean).join(" ")}
          data-slot="dropdown-menu-sub-content"
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  );
}
