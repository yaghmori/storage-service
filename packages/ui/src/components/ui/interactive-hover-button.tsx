import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, LucideIcon } from "lucide-react";
import React from "react";

const interactiveHoverButtonVariants = cva(
  "group relative w-38 cursor-pointer overflow-hidden rounded-full text-lg tracking-tight p-2 text-center font-semibold transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        primary: "bg-primary text-background",
        secondary: "bg-secondary text-white ",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof interactiveHoverButtonVariants> {
  text?: string;
  icon?: LucideIcon;
  textClassName?: string;
  iconClassName?: string;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(
  (
    {
      text = "Button",
      icon: Icon,
      iconClassName,
      variant,
      className,
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === "primary";
    const textColor = isPrimary ? "text-background" : variant === "secondary" ? "text-white" : "text-foreground";
    const iconFillColor = isPrimary ? "fill-background" : "fill-foreground";
    const iconTextColor = isPrimary ? "text-background" : "text-foreground";

    return (
      <button
        ref={ref}
        className={cn(interactiveHoverButtonVariants({ variant, className }))}
        {...props}
      >
        <span
          className={cn(
            "inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0",
            textColor
          )}
        >
          {text}
        </span>
        <div
          className={cn(
            "absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100",
            textColor
          )}
        >
          <span>{text}</span>
          <ArrowRight />
        </div>
        {Icon && (
          <Icon
            className={cn(
              "absolute left-[7%]  top-[35%] h-5 w-5 transition-all duration-300 group-hover:-translate-x-26",
              iconClassName,
              iconTextColor
            )}
          />
        )}
      </button>
    );
  }
);

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton, interactiveHoverButtonVariants };

