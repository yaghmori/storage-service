"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { resolveRender } from "@workspace/ui/lib/as-child";
import { cn } from "@workspace/ui/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />;
}

type PopoverTriggerProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean;
  render?: React.ReactElement;
};

function PopoverTrigger({
  asChild,
  render,
  children,
  ...props
}: PopoverTriggerProps) {
  const renderProp = resolveRender(asChild, children, render);
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </PopoverPrimitive.Trigger>
  );
}

type PopoverContentProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Popup>,
  "sideOffset"
> & {
  side?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  align?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
  sideOffset?: number;
};

function PopoverContent({
  className,
  align = "center",
  side,
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "bg-popover text-popover-foreground transition-[opacity,scale,transform,translate] duration-150 ease-out data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 z-50 w-72 origin-[var(--transform-origin)] rounded-md border p-4 shadow-md outline-hidden",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

/**
 * @deprecated Base UI does not have a separate Anchor primitive — anchor via
 * the trigger or pass `anchor` to a custom Positioner. Kept as a no-op alias
 * to avoid breaking imports.
 */
function PopoverAnchor({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
