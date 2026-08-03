"use client"

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import * as React from "react"

import { resolveRender } from "@workspace/ui/lib/as-child"
import { cn } from "@workspace/ui/lib/utils"

type SheetRootProps = React.ComponentProps<typeof SheetPrimitive.Root> & {
  /**
   * @deprecated Backwards-compat handler called when the user attempts to
   * close the sheet by clicking outside. Calling `e.preventDefault()` keeps
   * it open. New code should use `onOpenChange` with `eventDetails.cancel()`.
   */
  onInteractOutside?: (e: { preventDefault: () => void }) => void
  /**
   * @deprecated Backwards-compat handler called when Escape is pressed.
   * Calling `e.preventDefault()` keeps the sheet open.
   */
  onEscapeKeyDown?: (e: { preventDefault: () => void }) => void
}

function Sheet({
  onInteractOutside,
  onEscapeKeyDown,
  onOpenChange,
  ...props
}: SheetRootProps) {
  const handleOpenChange = React.useCallback(
    (
      open: boolean,
      eventDetails: SheetPrimitive.Root.ChangeEventDetails
    ) => {
      if (!open && (onInteractOutside || onEscapeKeyDown)) {
        let prevented = false
        const fakeEvent = {
          preventDefault: () => {
            prevented = true
            eventDetails.cancel()
          },
        }
        if (eventDetails.reason === "outside-press" && onInteractOutside) {
          onInteractOutside(fakeEvent)
          if (prevented) return
        }
        if (eventDetails.reason === "escape-key" && onEscapeKeyDown) {
          onEscapeKeyDown(fakeEvent)
          if (prevented) return
        }
      }
      onOpenChange?.(open, eventDetails)
    },
    [onInteractOutside, onEscapeKeyDown, onOpenChange]
  )

  return <SheetPrimitive.Root onOpenChange={handleOpenChange} {...props} />
}

type SheetTriggerProps = Omit<
  React.ComponentProps<typeof SheetPrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function SheetTrigger({
  asChild,
  render,
  children,
  ...props
}: SheetTriggerProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </SheetPrimitive.Trigger>
  )
}

type SheetCloseProps = Omit<
  React.ComponentProps<typeof SheetPrimitive.Close>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function SheetClose({
  asChild,
  render,
  children,
  ...props
}: SheetCloseProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <SheetPrimitive.Close
      data-slot="sheet-close"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </SheetPrimitive.Close>
  )
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal {...props} />
}

function SheetOverlay({
  className,
  forceRender = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      forceRender={forceRender}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-500 ease-out data-[ending-style]:duration-300 data-[ending-style]:ease-in data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Popup> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition-[translate,transform] duration-500 ease-out data-[ending-style]:duration-300 data-[ending-style]:ease-in",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
