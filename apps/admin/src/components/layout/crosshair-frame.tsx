import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

const RAIL_V =
  "pointer-events-none absolute -top-[100vh] -bottom-[100vh] w-0 border-l border-dashed border-border";
const RAIL_H =
  "pointer-events-none absolute -left-[100vw] -right-[100vw] h-0 border-t border-dashed border-border";
const MARK =
  "pointer-events-none absolute size-[7px] border border-border bg-background";

/**
 * Wraps content in dashed rules that bleed past the viewport, with a small
 * square marking each intersection. Needs an ancestor that clips overflow.
 */
export function CrosshairFrame({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <span aria-hidden="true" className={cn(RAIL_V, "left-0")} />
      <span aria-hidden="true" className={cn(RAIL_V, "right-0")} />
      <span aria-hidden="true" className={cn(RAIL_H, "top-0")} />
      <span aria-hidden="true" className={cn(RAIL_H, "bottom-0")} />

      <span aria-hidden="true" className={cn(MARK, "-top-[4px] -left-[4px]")} />
      <span
        aria-hidden="true"
        className={cn(MARK, "-top-[4px] -right-[4px]")}
      />
      <span
        aria-hidden="true"
        className={cn(MARK, "-bottom-[4px] -left-[4px]")}
      />
      <span
        aria-hidden="true"
        className={cn(MARK, "-bottom-[4px] -right-[4px]")}
      />

      <div className={cn("p-4 sm:p-8", innerClassName)}>{children}</div>
    </div>
  );
}
