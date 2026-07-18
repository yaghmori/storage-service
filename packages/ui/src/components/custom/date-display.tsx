"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  formatDate,
  formatDateInTimezone,
  formatUTCDate,
  getTimestamp,
  getTimezoneInfo,
  type DateDisplayFormat,
} from "@workspace/ui/lib/date-utils";
import { usePreferredTimezone } from "@workspace/ui/providers/timezone-provider";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface DateDisplayProps {
  /** The date to display - can be ISO 8601 string, Date object, or timestamp */
  date: Date | string | number | undefined;
  /** Display format for the main text */
  format?: DateDisplayFormat;
  /** Whether to show the tooltip on hover */
  showTooltip?: boolean;
  /** Custom timezone for the tooltip (defaults to user preference, then browser) */
  timezone?: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom tooltip content */
  customTooltipContent?: React.ReactNode;
}

/**
 * A flexible date display component that shows dates in different formats
 * and provides detailed timezone information in a tooltip on hover.
 */
export function DateDisplay({
  date,
  format = "short",
  showTooltip = true,
  timezone = "",
  className,
  customTooltipContent,
}: DateDisplayProps) {
  const { timezone: contextTimezone } = usePreferredTimezone();
  const detectedTimezone = timezone || contextTimezone;
  const formattedDate = formatDate(date, format, detectedTimezone);

  if (!formattedDate) {
    return (
      <span
        className={cn(
          "text-muted-foreground font-mono tracking-tighter whitespace-nowrap",
          className
        )}
      >
        —
      </span>
    );
  }

  const tooltipContent = customTooltipContent || (
    <div className="space-y-1 text-xs   p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono tracking-tighter">
          UTC:
        </span>
        <span>{formatUTCDate(date as Date)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground font-mono tracking-tighter">
          {getTimezoneInfo(detectedTimezone)}:
        </span>
        <span>{formatDateInTimezone(date as Date, detectedTimezone)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 ">
        <span className="text-muted-foreground font-mono tracking-tighter">
          Relative:
        </span>
        <span>{formatDate(date as Date, "relative")}</span>
      </div>
      <div className="flex items-center justify-between gap-4 ">
        <span className="text-muted-foreground font-mono tracking-tighter">
          Timestamp:
        </span>
        <span>{getTimestamp(date as Date)}</span>
      </div>
    </div>
  );

  if (!showTooltip) {
    return (
      <span className={cn("inline-block whitespace-nowrap", className)}>
        {formattedDate}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-block whitespace-nowrap cursor-help hover:text-foreground transition-colors underline underline-offset-4 decoration-dotted decoration-muted-foreground/50",
            className
          )}
        >
          {formattedDate}
        </span>
      </TooltipTrigger>
      <TooltipContent
        arrowClassName="bg-popover fill-popover"
        align="center"
        className="p-3 bg-popover text-popover-foreground border border-border shadow-md [&>svg]:fill-popover [&>svg]:border-popover"
      >
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A specialized component for displaying relative time with enhanced tooltip
 */
export function RelativeDateDisplay({
  date,
  showTooltip = true,
  timezone = "",
  className,
}: Omit<DateDisplayProps, "format">) {
  return (
    <DateDisplay
      date={date}
      format="relative"
      showTooltip={showTooltip}
      timezone={timezone}
      className={cn("text-muted-foreground", className)}
    />
  );
}

/**
 * A specialized component for displaying short dates
 */
export function ShortDateDisplay({
  date,
  showTooltip = true,
  timezone = "",
  className,
}: Omit<DateDisplayProps, "format">) {
  return (
    <DateDisplay
      date={date}
      format="short"
      showTooltip={showTooltip}
      timezone={timezone}
      className={className}
    />
  );
}

/**
 * A specialized component for displaying long dates
 */
export function LongDateDisplay({
  date,
  showTooltip = true,
  timezone = "",
  className,
}: Omit<DateDisplayProps, "format">) {
  return (
    <DateDisplay
      date={date}
      format="long"
      showTooltip={showTooltip}
      timezone={timezone}
      className={className}
    />
  );
}
