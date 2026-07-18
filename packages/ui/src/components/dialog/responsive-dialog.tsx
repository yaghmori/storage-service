"use client";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { Separator } from "@workspace/ui/components/separator";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { cn } from "@workspace/ui/lib/utils";

type ResponsiveDialogContextType = {
  isDesktop: boolean;
  isOpen: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  canClose?: boolean;
  allowOutsideClick?: boolean;
};

const ResponsiveDialogContext =
  React.createContext<ResponsiveDialogContextType | null>(null);

const useResponsiveDialog = () => {
  const context = React.useContext(ResponsiveDialogContext);
  if (!context) {
    throw new Error(
      "useResponsiveDialog must be used within a ResponsiveDialog"
    );
  }
  return context;
};

interface ResponsiveDialogProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  className?: string;
  canClose?: boolean;
  allowOutsideClick?: boolean;
}

const ResponsiveDialog = ({
  trigger,
  children,
  open,
  onOpenChange,
  size,
  className,
  canClose = true,
  allowOutsideClick = false,
}: ResponsiveDialogProps) => {
  const isDesktop = useMediaQuery();

  return (
    <ResponsiveDialogContext.Provider
      value={{
        isDesktop,
        isOpen: open,
        onOpenChange,
        size,
        canClose,
        allowOutsideClick,
      }}
    >
      {isDesktop ? (
        <Dialog
          open={open}
          onOpenChange={onOpenChange}
          onInteractOutside={(e) => {
            if (!canClose || !allowOutsideClick) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!canClose) {
              e.preventDefault();
            }
          }}
        >
          {trigger != null && <DialogTrigger asChild>{trigger}</DialogTrigger>}

          <DialogContent
            size={size}
            showCloseButton={false}
            className={cn("flex flex-col p-4", className)}
          >
            {children}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {trigger != null && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}

          <DrawerContent
            onInteractOutside={(e: Event) => {
              if (!canClose || !allowOutsideClick) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e: KeyboardEvent) => {
              if (!canClose) {
                e.preventDefault();
              }
            }}
          >
            {children}
          </DrawerContent>
        </Drawer>
      )}
    </ResponsiveDialogContext.Provider>
  );
};

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

const Header = ({ children, className }: HeaderProps) => {
  const { isDesktop, canClose } = useResponsiveDialog();

  if (isDesktop) {
    return (
      <DialogHeader className={cn("relative  pb-5", className)}>
        {children}
        {canClose && (
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        )}
      </DialogHeader>
    );
  }

  return (
    <DrawerHeader
      className={cn("text-left justify-start self-start", className)}
    >
      {children}
    </DrawerHeader>
  );
};

interface TitleProps {
  children: React.ReactNode;
  className?: string;
}

interface TriggerProps {
  children: React.ReactNode;
  className?: string;
}

const Trigger = ({ children, className }: TriggerProps) => {
  const { isDesktop } = useResponsiveDialog();

  if (isDesktop) {
    return <DialogTrigger asChild>{children}</DialogTrigger>;
  }
  return <DrawerTrigger asChild>{children}</DrawerTrigger>;
};

const Title = ({ children, className }: TitleProps) => {
  const { isDesktop } = useResponsiveDialog();

  if (isDesktop) {
    return <DialogTitle className={className}>{children}</DialogTitle>;
  }

  return (
    <DrawerTitle className={cn("justify-start self-start", className)}>
      {children}
    </DrawerTitle>
  );
};

interface DescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const Description = ({ children, className }: DescriptionProps) => {
  const { isDesktop } = useResponsiveDialog();

  if (isDesktop) {
    return (
      <DialogDescription className={className}>{children}</DialogDescription>
    );
  }

  return (
    <DrawerDescription className={cn("text-start", className)}>
      {children}
    </DrawerDescription>
  );
};

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

const Content = ({ children, className }: ContentProps) => {
  const { isDesktop } = useResponsiveDialog();

  if (isDesktop) {
    return (
      <div className={cn("overflow-y-auto p-1", className)}>{children}</div>
    );
  }

  return (
    <div className={cn("w-full overflow-y-auto px-4 pb-10", className)}>
      {children}
    </div>
  );
};

interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

const Footer = ({ children, className }: FooterProps) => {
  const { isDesktop } = useResponsiveDialog();

  if (isDesktop) {
    return (
      <DialogFooter>
        <div className="flex w-full flex-col gap-2">
          <Separator className="my-2 w-full" />
          <div className={cn("flex flex-row justify-end gap-2", className)}>
            {children}
          </div>
        </div>
      </DialogFooter>
    );
  }

  return (
    <DrawerFooter
      className={cn(
        "flex flex-col-reverse justify-end gap-2 px-3 pt-1 pb-3",
        className
      )}
    >
      {children}
    </DrawerFooter>
  );
};

interface CloseProps {
  children?: React.ReactNode;
  className?: string;
}

const Close = ({ children, className }: CloseProps) => {
  const { isDesktop, canClose } = useResponsiveDialog();

  if (!canClose) {
    return null;
  }

  if (isDesktop) {
    return <DialogClose className={className}>{children}</DialogClose>;
  }

  return <DrawerClose className={className}>{children}</DrawerClose>;
};

ResponsiveDialog.Header = Header;
ResponsiveDialog.Title = Title;
ResponsiveDialog.Description = Description;
ResponsiveDialog.Content = Content;
ResponsiveDialog.Footer = Footer;
ResponsiveDialog.Trigger = Trigger;
ResponsiveDialog.Close = Close;

export { ResponsiveDialog };
