"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { resolveRender } from "@workspace/ui/lib/as-child";
import { cn } from "@workspace/ui/lib/utils";

type DialogRootProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  /**
   * @deprecated Backwards-compat handler called when the user attempts to
   * close the dialog by clicking outside. Calling `e.preventDefault()` keeps
   * it open. New code should use `onOpenChange` with `eventDetails.cancel()`.
   */
  onInteractOutside?: (e: { preventDefault: () => void }) => void
  /**
   * @deprecated Backwards-compat handler called when Escape is pressed.
   * Calling `e.preventDefault()` keeps the dialog open.
   */
  onEscapeKeyDown?: (e: { preventDefault: () => void }) => void
}

function Dialog({
  onInteractOutside,
  onEscapeKeyDown,
  onOpenChange,
  ...props
}: DialogRootProps) {
  const handleOpenChange = React.useCallback(
    (
      open: boolean,
      eventDetails: DialogPrimitive.Root.ChangeEventDetails
    ) => {
      if (!open && (onInteractOutside || onEscapeKeyDown)) {
        let prevented = false
        const fakeEvent = {
          preventDefault: () => {
            prevented = true
            eventDetails.cancel()
          },
        }
        if (
          eventDetails.reason === "outside-press" &&
          onInteractOutside
        ) {
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

  return (
    <DialogPrimitive.Root onOpenChange={handleOpenChange} {...props} />
  )
}

type DialogTriggerProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function DialogTrigger({
  asChild,
  render,
  children,
  ...props
}: DialogTriggerProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </DialogPrimitive.Trigger>
  )
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />;
}

type DialogCloseProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Close>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function DialogClose({
  asChild,
  render,
  children,
  ...props
}: DialogCloseProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </DialogPrimitive.Close>
  )
}

function DialogOverlay({
  className,
  forceRender = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      forceRender={forceRender}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  size = "lg",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 transition-[opacity,scale,transform,translate] ease-out data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-xl",
          size === "xl" && "sm:max-w-2xl",
          size === "2xl" && "sm:max-w-3xl",
          size === "3xl" && "sm:max-w-4xl",
          size === "full" && "sm:max-w-full",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[open]:bg-accent data-[open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

type DialogDescriptionProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Description>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function DialogDescription({
  className,
  asChild,
  render,
  children,
  ...props
}: DialogDescriptionProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-start text-sm", className)}
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </DialogPrimitive.Description>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
