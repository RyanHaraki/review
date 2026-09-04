import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

export function TooltipProvider({
  delay = 400,
  children,
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider delay={delay}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger {...props} />;
}

export function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          className={[
            "z-50 w-fit max-w-xs rounded-md border border-border bg-accent px-3 py-1.5 text-xs text-white shadow-lg",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 fill-accent data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=left]:top-1/2 data-[side=left]:-translate-y-1/2 data-[side=right]:-left-1 data-[side=right]:top-1/2 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-1" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}
