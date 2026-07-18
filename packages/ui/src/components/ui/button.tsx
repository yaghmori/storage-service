"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
        outlineDestructive:
          "border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/10 dark:focus-visible:ring-destructive/40",
        ghostDestructive: "text-destructive hover:bg-destructive/10",
        secondaryDestructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default:
          "h-10  gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-10",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * When `true`, the rendered element is the single child element (with merged
     * props) rather than a native `<button>`. Equivalent to Base UI's `render={...}` pattern.
     */
    asChild?: boolean;
    /**
     * Base UI `render` prop. Takes precedence over `asChild`/`children` when provided.
     */
    render?: useRender.RenderProp;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  render,
  children,
  ...props
}: ButtonProps) {
  const mergedClassName = cn(buttonVariants({ variant, size, className }));

  const renderProp = React.useMemo<useRender.RenderProp | undefined>(() => {
    if (render !== undefined) return render;
    if (asChild && React.isValidElement(children)) return children;
    return undefined;
  }, [render, asChild, children]);

  const element = useRender({
    render: renderProp ?? <button />,
    props: {
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      className: mergedClassName,
      ...(renderProp ? {} : { children }),
      ...props,
    },
  });

  return element;
}

export { Button, buttonVariants };
