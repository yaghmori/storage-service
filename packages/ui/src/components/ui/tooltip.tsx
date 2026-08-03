"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { resolveRender } from "@workspace/ui/lib/as-child";
import { cn } from "@workspace/ui/lib/utils";

type LegacyTooltipProviderProps = React.ComponentProps<
  typeof TooltipPrimitive.Provider
> & {
  /**
   * @deprecated Renamed to `delay` in Base UI. Kept for backwards-compat.
   */
  delayDuration?: number;
};

function TooltipProvider({
  delay,
  delayDuration,
  ...props
}: LegacyTooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      delay={delay ?? delayDuration ?? 0}
      {...props}
    />
  );
}

type LegacyTooltipRootProps = React.ComponentProps<
  typeof TooltipPrimitive.Root
> & {
  /**
   * @deprecated The `delayDuration` prop lived on the Root in Radix; in Base UI
   * the delay is configured on the {@link TooltipProvider}. We forward it here
   * by wrapping in a fresh provider when `delayDuration` is set.
   */
  delayDuration?: number;
};

function Tooltip({ delayDuration, ...props }: LegacyTooltipRootProps) {
  if (delayDuration !== undefined) {
    return (
      <TooltipProvider delay={delayDuration}>
        <TooltipPrimitive.Root {...props} />
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props} />
    </TooltipProvider>
  );
}

type TooltipTriggerProps = Omit<
  React.ComponentProps<typeof TooltipPrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean;
  render?: React.ReactElement;
};

function TooltipTrigger({
  asChild,
  render,
  children,
  ...props
}: TooltipTriggerProps) {
  const renderProp = resolveRender(asChild, children, render);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </TooltipPrimitive.Trigger>
  );
}

type TooltipContentProps = Omit<
  React.ComponentProps<typeof TooltipPrimitive.Popup>,
  "sideOffset"
> & {
  sideOffset?: number;
  side?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
  align?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["align"];
  arrowClassName?: string;
};

function TooltipContent({
  className,
  sideOffset = 0,
  side,
  align,
  children,
  arrowClassName,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={sideOffset}
        side={side}
        align={align}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-primary text-primary-foreground transition-[opacity,scale,transform,translate] duration-150 ease-out data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 z-50 w-fit origin-[var(--transform-origin)] rounded-md px-3 py-1.5 text-xs text-balance",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className={cn(
              " bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
              arrowClassName
            )}
          />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
