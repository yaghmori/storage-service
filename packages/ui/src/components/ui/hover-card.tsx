"use client"

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"
import * as React from "react"

import { resolveRender } from "@workspace/ui/lib/as-child"
import { cn } from "@workspace/ui/lib/utils"

const HoverCardDelayContext = React.createContext<{
  delay?: number
  closeDelay?: number
}>({})

type LegacyHoverCardProps = React.ComponentProps<
  typeof PreviewCardPrimitive.Root
> & {
  /**
   * @deprecated In Base UI, delay is configured on the Trigger as `delay`.
   * This prop is forwarded to {@link HoverCardTrigger} via context.
   */
  openDelay?: number
  /**
   * @deprecated In Base UI, this prop lives on the Trigger.
   * Forwarded to {@link HoverCardTrigger} via context.
   */
  closeDelay?: number
}

function HoverCard({ openDelay, closeDelay, children, ...props }: LegacyHoverCardProps) {
  const value = React.useMemo(
    () => ({ delay: openDelay, closeDelay }),
    [openDelay, closeDelay]
  )

  return (
    <HoverCardDelayContext.Provider value={value}>
      <PreviewCardPrimitive.Root {...props}>{children}</PreviewCardPrimitive.Root>
    </HoverCardDelayContext.Provider>
  )
}

type HoverCardTriggerProps = Omit<
  React.ComponentProps<typeof PreviewCardPrimitive.Trigger>,
  "render"
> & {
  /**
   * Backwards-compat with the Radix `asChild` pattern. When `true`, the single
   * child element is used as the trigger via Base UI's `render` prop.
   */
  asChild?: boolean
  render?: React.ReactElement
}

function HoverCardTrigger({
  asChild,
  children,
  delay,
  closeDelay,
  render,
  ...props
}: HoverCardTriggerProps) {
  const ctx = React.useContext(HoverCardDelayContext)
  const renderProp = resolveRender(asChild, children, render)

  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      delay={delay ?? ctx.delay}
      closeDelay={closeDelay ?? ctx.closeDelay}
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </PreviewCardPrimitive.Trigger>
  )
}

type HoverCardContentProps = Omit<
  React.ComponentProps<typeof PreviewCardPrimitive.Popup>,
  "sideOffset"
> & {
  align?: React.ComponentProps<typeof PreviewCardPrimitive.Positioner>["align"]
  side?: React.ComponentProps<typeof PreviewCardPrimitive.Positioner>["side"]
  sideOffset?: number
  collisionPadding?: number
}

function HoverCardContent({
  className,
  align = "center",
  side,
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: HoverCardContentProps) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "bg-popover text-popover-foreground transition-[opacity,scale,transform,translate] duration-150 ease-out data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 z-50 w-64 origin-[var(--transform-origin)] rounded-md border p-4 shadow-md outline-hidden",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardContent, HoverCardTrigger }
