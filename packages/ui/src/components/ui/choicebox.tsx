"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { CircleIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";

import { RadioGroup } from "./radio-group";

export type ChoiceboxProps = ComponentProps<typeof RadioGroup>;

export const Choicebox = ({ className, ...props }: ChoiceboxProps) => (
  <RadioGroup className={cn("w-full", className)} {...props} />
);

export type ChoiceboxItemProps = ComponentProps<typeof RadioPrimitive.Root>;

export const ChoiceboxItem = ({
  className,
  children,
  ...props
}: ChoiceboxItemProps) => {
  const card = (
    <Card
      className={cn(
        "flex cursor-pointer flex-row items-start justify-between rounded-md p-4 shadow-none transition-all",
        className
      )}
    >
      {children}
    </Card>
  ) as ReactElement;

  return (
    <RadioPrimitive.Root
      render={card}
      className={cn(
        "text-left",
        "data-[checked]:border-primary",
        "data-[checked]:bg-primary-foreground"
      )}
      {...props}
    />
  );
};

export type ChoiceboxItemHeaderProps = ComponentProps<typeof CardHeader>;

export const ChoiceboxItemHeader = ({
  className,
  ...props
}: ComponentProps<typeof CardHeader>) => (
  <CardHeader className={cn("flex-1 p-0", className)} {...props} />
);

export type ChoiceboxItemTitleProps = ComponentProps<typeof CardTitle>;

export const ChoiceboxItemTitle = ({
  className,
  ...props
}: ChoiceboxItemTitleProps) => (
  <CardTitle
    className={cn("flex items-center gap-2 text-sm", className)}
    {...props}
  />
);

export type ChoiceboxItemSubtitleProps = HTMLAttributes<HTMLSpanElement>;

export const ChoiceboxItemSubtitle = ({
  className,
  ...props
}: ChoiceboxItemSubtitleProps) => (
  <span
    className={cn("text-muted-foreground text-xs font-normal", className)}
    {...props}
  />
);

export type ChoiceboxItemDescriptionProps = ComponentProps<
  typeof CardDescription
>;

export const ChoiceboxItemDescription = ({
  className,
  ...props
}: ChoiceboxItemDescriptionProps) => (
  <CardDescription className={cn("text-sm", className)} {...props} />
);

export type ChoiceboxItemContentProps = ComponentProps<typeof CardContent>;

export const ChoiceboxItemContent = ({
  className,
  ...props
}: ChoiceboxItemContentProps) => (
  <CardContent
    className={cn(
      "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border p-0 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export type ChoiceboxItemIndicatorProps = ComponentProps<
  typeof RadioPrimitive.Indicator
>;

export const ChoiceboxItemIndicator = ({
  className,
  ...props
}: ChoiceboxItemIndicatorProps) => {
  const icon = (
    <CircleIcon className={cn("fill-primary size-2", className)} />
  ) as ReactElement;
  return <RadioPrimitive.Indicator render={icon} {...props} />;
};
