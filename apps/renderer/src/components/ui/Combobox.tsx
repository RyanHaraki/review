import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { ComponentProps } from "react";

type ComboboxTriggerVariant = "default" | "toolbar";

type ComboboxTriggerProps = ComponentProps<typeof ComboboxPrimitive.Trigger> & {
  variant?: ComboboxTriggerVariant;
};

const triggerVariantClasses: Record<ComboboxTriggerVariant, string> = {
  default:
    "min-h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-text",
  toolbar:
    "h-7 rounded-md border border-border-strong bg-surface px-2.5 text-[0.8rem] font-medium text-text [@media(hover:hover)]:hover:bg-surface-hover",
};

export const Combobox = ComboboxPrimitive.Root;

export function ComboboxTrigger({
  children,
  className,
  variant = "default",
  ...props
}: ComboboxTriggerProps) {
  return (
    <ComboboxPrimitive.Trigger
      className={[
        "[-webkit-app-region:no-drag] inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap outline-none outline-offset-2 transition-[background-color,border-color,color] duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus",
        triggerVariantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-slot="combobox-trigger"
      data-variant={variant}
      {...props}
    >
      {children}
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0 text-text-secondary"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m4 6 4 4 4-4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </ComboboxPrimitive.Trigger>
  );
}

type ComboboxContentProps = ComponentProps<typeof ComboboxPrimitive.Popup> &
  Pick<
    ComponentProps<typeof ComboboxPrimitive.Positioner>,
    "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
  >;

export function ComboboxContent({
  align = "end",
  alignOffset = 0,
  anchor,
  className,
  side = "bottom",
  sideOffset = 6,
  ...props
}: ComboboxContentProps) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxPrimitive.Popup
          className={[
            "w-[var(--anchor-width)] min-w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-strong bg-surface text-text shadow-[0_18px_48px_rgb(35_38_36_/_0.16)] outline-none [color-scheme:light]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          data-slot="combobox-content"
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export function ComboboxInput({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <div className="border-b border-border p-1.5">
      <ComboboxPrimitive.Input
        className={[
          "h-8 w-full rounded-lg bg-panel px-2.5 text-sm text-text outline-none placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-focus",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-slot="combobox-input"
        {...props}
      />
    </div>
  );
}

export function ComboboxList({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.List>) {
  return (
    <ComboboxPrimitive.List
      className={["max-h-64 overflow-y-auto overscroll-contain p-1.5", className]
        .filter(Boolean)
        .join(" ")}
      data-slot="combobox-list"
      {...props}
    />
  );
}

export function ComboboxItem({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      className={[
        "flex min-h-10 w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[highlighted]:bg-surface-hover [@media(hover:hover)]:hover:bg-surface-hover",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-slot="combobox-item"
      {...props}
    />
  );
}

export function ComboboxEmpty({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      className={["px-3 py-6 text-center text-sm text-text-secondary", className]
        .filter(Boolean)
        .join(" ")}
      data-slot="combobox-empty"
      {...props}
    />
  );
}
