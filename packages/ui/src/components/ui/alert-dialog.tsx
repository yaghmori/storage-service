"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import * as React from "react";

import { buttonVariants } from "@workspace/ui/components/button";
import { resolveRender } from "@workspace/ui/lib/as-child";
import { cn } from "@workspace/ui/lib/utils";

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root {...props} />;
}

type AlertDialogTriggerProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean;
  render?: React.ReactElement;
};

function AlertDialogTrigger({
  asChild,
  render,
  children,
  ...props
}: AlertDialogTriggerProps) {
  const renderProp = resolveRender(asChild, children, render);
  return (
    <AlertDialogPrimitive.Trigger
      data-slot="alert-dialog-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </AlertDialogPrimitive.Trigger>
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal {...props} />;
}

function AlertDialogOverlay({
  className,
  forceRender = true,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      forceRender={forceRender}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg transition-[opacity,scale,transform,translate] ease-out data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2  text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

type AlertDialogDescriptionProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Description>,
  "render"
> & {
  asChild?: boolean;
  render?: React.ReactElement;
};

function AlertDialogDescription({
  className,
  asChild,
  render,
  children,
  ...props
}: AlertDialogDescriptionProps) {
  const renderProp = resolveRender(asChild, children, render);
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </AlertDialogPrimitive.Description>
  );
}

type AlertButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "outlineDestructive"
  | "ghostDestructive"
  | "secondaryDestructive";

type AlertDialogActionProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Close>,
  "render"
> & {
  variant?: AlertButtonVariant;
  asChild?: boolean;
  render?: React.ReactElement;
};

function AlertDialogAction({
  className,
  variant,
  asChild,
  render,
  children,
  ...props
}: AlertDialogActionProps) {
  // Base UI doesn't have a separate Action primitive — use Close which dismisses
  // the dialog by default; consumers can supply their own onClick to confirm.
  const renderProp = resolveRender(asChild, children, render);
  return (
    <AlertDialogPrimitive.Close
      className={cn(buttonVariants({ variant }), className)}
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </AlertDialogPrimitive.Close>
  );
}

type AlertDialogCancelProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Close>,
  "render"
> & {
  asChild?: boolean;
  render?: React.ReactElement;
};

function AlertDialogCancel({
  className,
  asChild,
  render,
  children,
  ...props
}: AlertDialogCancelProps) {
  const renderProp = resolveRender(asChild, children, render);
  return (
    <AlertDialogPrimitive.Close
      className={cn(buttonVariants({ variant: "outline" }), className)}
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </AlertDialogPrimitive.Close>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
