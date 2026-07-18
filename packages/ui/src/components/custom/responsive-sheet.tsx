"use client";
import * as React from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { cn } from "@workspace/ui/lib/utils";

type ResponsiveSheetContextType = {
  isDesktop: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  canClose?: boolean;
  allowOutsideClick?: boolean;
};

const ResponsiveSheetContext =
  React.createContext<ResponsiveSheetContextType | null>(null);

const useResponsiveSheet = () => {
  const context = React.useContext(ResponsiveSheetContext);
  if (!context) {
    throw new Error("useResponsiveSheet must be used within a ResponsiveSheet");
  }
  return context;
};

interface ResponsiveSheetProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  breakpoint?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  canClose?: boolean;
  allowOutsideClick?: boolean;
}

const ResponsiveSheet = ({
  trigger,
  children,
  breakpoint = 680,
  open,
  onOpenChange,
  side = "right",
  className,
  canClose = true,
  allowOutsideClick = true,
}: ResponsiveSheetProps) => {
  const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`);

  return (
    <ResponsiveSheetContext.Provider
      value={{
        isDesktop,
        isOpen: open,
        onOpenChange,
        side,
        canClose,
        allowOutsideClick,
      }}
    >
      {isDesktop ? (
        <Sheet
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
          {trigger != null && <SheetTrigger asChild>{trigger}</SheetTrigger>}

          <SheetContent
            side={side}
            className={cn(
              // Constrained flex column: header/footer stick, body scrolls.
              "flex h-full max-h-dvh flex-col gap-0 overflow-hidden p-1",
              className,
            )}
          >
            {children}
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {trigger != null && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}

          <DrawerContent
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
            className={cn(
              // Override drawer h-auto so flex children can scroll within max height.
              "flex max-h-[90dvh] flex-col gap-0 overflow-hidden",
              className,
            )}
          >
            {children}
          </DrawerContent>
        </Drawer>
      )}
    </ResponsiveSheetContext.Provider>
  );
};

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

const Header = ({ children, className }: HeaderProps) => {
  const { isDesktop } = useResponsiveSheet();

  if (isDesktop) {
    return (
      <SheetHeader className={cn("relative shrink-0 p-5 pb-2", className)}>
        <div className="flex-1">{children}</div>
      </SheetHeader>
    );
  }

  return (
    <DrawerHeader
      className={cn("shrink-0 justify-start self-stretch text-left", className)}
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
  const { isDesktop } = useResponsiveSheet();

  if (isDesktop) {
    return <SheetTrigger asChild>{children}</SheetTrigger>;
  }
  return <DrawerTrigger asChild>{children}</DrawerTrigger>;
};

const Title = ({ children, className }: TitleProps) => {
  const { isDesktop } = useResponsiveSheet();

  if (isDesktop) {
    return <SheetTitle className={className}>{children}</SheetTitle>;
  }

  return (
    <DrawerTitle className={cn("justify-start self-start text-left", className)}>
      {children}
    </DrawerTitle>
  );
};

interface DescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const Description = ({ children, className }: DescriptionProps) => {
  const { isDesktop } = useResponsiveSheet();

  if (isDesktop) {
    return (
      <SheetDescription className={cn("text-start", className)}>
        {children}
      </SheetDescription>
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
  const { isDesktop } = useResponsiveSheet();

  // min-h-0 is required for flex-1 + overflow to scroll inside a flex column.
  return (
    <div
      className={cn(
        "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-5 py-1",
        !isDesktop && "px-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

const Footer = ({ children, className }: FooterProps) => {
  const { isDesktop } = useResponsiveSheet();

  if (isDesktop) {
    return (
      <SheetFooter
        className={cn(
          "shrink-0 border-t bg-background p-5",
          className,
        )}
      >
        <div className="flex w-full justify-end gap-2">{children}</div>
      </SheetFooter>
    );
  }

  return (
    <DrawerFooter
      className={cn(
        "mt-0 shrink-0 border-t bg-background pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
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
  const { isDesktop, canClose } = useResponsiveSheet();

  if (!canClose) {
    return null;
  }

  if (isDesktop) {
    return <SheetClose className={className}>{children}</SheetClose>;
  }

  return <DrawerClose className={className}>{children}</DrawerClose>;
};

ResponsiveSheet.Header = Header;
ResponsiveSheet.Title = Title;
ResponsiveSheet.Description = Description;
ResponsiveSheet.Content = Content;
ResponsiveSheet.Footer = Footer;
ResponsiveSheet.Trigger = Trigger;
ResponsiveSheet.Close = Close;

export { ResponsiveSheet };
