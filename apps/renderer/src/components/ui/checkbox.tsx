import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import type { ComponentProps } from "react";

type CheckboxIndicatorProps = ComponentProps<"span"> & {
  checked: boolean;
};

export function CheckboxIndicator({
  checked,
  className,
  ...props
}: CheckboxIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,color] duration-100",
        checked
          ? "border-accent bg-accent text-white"
          : "border-border-strong bg-surface text-transparent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <svg className="size-3" fill="none" viewBox="0 0 16 16">
        <path
          d="m3.5 8.5 2.5 2.5 6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={[
        "peer relative grid size-4 shrink-0 place-items-center rounded-[4px] border border-border-strong bg-surface text-white outline-none outline-offset-2 transition-[background-color,border-color] duration-100 after:absolute after:-inset-2 data-checked:border-accent data-checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="grid place-items-center"
        data-slot="checkbox-indicator"
      >
        <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 16 16">
          <path
            d="m3.5 8.5 2.5 2.5 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
