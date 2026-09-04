import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";

const buttonVariantClasses = {
  default:
    "border-transparent bg-accent text-white [@media(hover:hover)]:hover:bg-[#333331]",
  outline:
    "border border-border-strong bg-surface text-text [@media(hover:hover)]:hover:bg-surface-hover",
  secondary:
    "border-transparent bg-surface-selected text-text [@media(hover:hover)]:hover:bg-surface-hover",
  ghost:
    "border-transparent text-text [@media(hover:hover)]:hover:bg-surface-hover",
  text:
    "!h-auto !rounded-none !border-transparent !bg-transparent !p-0 font-normal text-text-secondary [@media(hover:hover)]:hover:bg-transparent [@media(hover:hover)]:hover:text-black",
  destructive:
    "border-transparent bg-red-600 text-white [@media(hover:hover)]:hover:bg-red-700",
  link:
    "border-transparent text-text underline-offset-4 [@media(hover:hover)]:hover:underline",
} as const;

const buttonSizeClasses = {
  xs: "h-6 gap-1 rounded-md px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-md px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  default:
    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  "icon-xs":
    "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-7 rounded-md",
  icon: "size-8",
  "icon-lg": "size-9",
} as const;

type ButtonVariant = keyof typeof buttonVariantClasses;
type ButtonSize = keyof typeof buttonSizeClasses;

type ButtonVariantOptions = {
  className?: string | undefined;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, "className"> &
  ButtonVariantOptions;

export function buttonVariants({
  className,
  size = "default",
  variant = "default",
}: ButtonVariantOptions = {}) {
  return [
    "group/button cursor-pointer [-webkit-app-region:no-drag] inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border bg-clip-padding text-sm font-medium outline-none outline-offset-2 transition-[background-color,border-color,color,opacity,scale,transform] duration-100 active:not-aria-[haspopup]:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus [&_svg]:pointer-events-none [&_svg]:shrink-0",
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  className,
  size = "default",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      data-slot="button"
      data-size={size}
      data-variant={variant}
      className={buttonVariants({ className, size, variant })}
      {...props}
    />
  );
}
