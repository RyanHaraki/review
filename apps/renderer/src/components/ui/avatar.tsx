import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type { ComponentProps } from "react";

type AvatarSize = "default" | "sm" | "lg";

type AvatarProps = AvatarPrimitive.Root.Props & {
  size?: AvatarSize;
};

export function Avatar({ className, size = "default", ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={[
        "group/avatar relative flex shrink-0 select-none overflow-hidden rounded-full after:absolute after:inset-0 after:border after:border-black/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={["aspect-square size-full object-cover", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={[
        "flex size-full items-center justify-center bg-surface-selected text-sm text-text-secondary group-data-[size=sm]/avatar:text-xs",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function AvatarBadge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={[
        "absolute right-0 bottom-0 z-10 inline-flex size-2 items-center justify-center rounded-full ring-2 ring-surface",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={["flex -space-x-2", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function AvatarGroupCount({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={["relative flex shrink-0 items-center justify-center", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
