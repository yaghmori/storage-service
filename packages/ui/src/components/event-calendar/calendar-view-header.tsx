"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  gridClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
  className?: string;
  sticky?: boolean;
};

export function CalendarViewHeader({
  gridClassName,
  style,
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "bg-card border-border grid border-b",
        gridClassName,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

type HeaderCellProps = {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button";
};

export function CalendarHeaderCell({
  children,
  className,
  onClick,
  as = "div",
}: HeaderCellProps) {
  const baseClass = cn(
    "border-border/60 px-2 py-2.5 transition-colors",
    onClick && "hover:bg-accent/50 cursor-pointer",
    className,
  );

  if (as === "button" && onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {children}
      </button>
    );
  }

  return <div className={baseClass}>{children}</div>;
}
