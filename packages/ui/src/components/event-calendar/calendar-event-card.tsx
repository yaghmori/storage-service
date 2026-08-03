"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { ReactNode } from "react";
import type { CalendarEvent } from "./types";
import {
  APPOINTMENT_CARD_SUBTITLE_MIN_HEIGHT_PX,
  APPOINTMENT_STATUS_DOT_CLASS,
  FIXED_EVENT_HEIGHT_DAY_PX,
  FIXED_EVENT_HEIGHT_DENSE_PX,
  FIXED_EVENT_HEIGHT_PX,
} from "./types";
import { normalizeServiceColor, serviceColorToCardStyle } from "./service-color";

export type CalendarEventCardVariant = "week" | "day" | "month";

function EventLabel({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("block min-w-0 truncate leading-snug", className)}>
      {text}
    </span>
  );
}

function PatientSubtitle({
  lead,
  name,
  className,
}: {
  lead?: string;
  name?: string;
  className?: string;
}) {
  const displayName = name?.trim();
  if (!lead && !displayName) return null;

  return (
    <span className={cn("block min-w-0 truncate leading-snug", className)}>
      {lead ? <span className="font-bold">{lead}</span> : null}
      {lead && displayName ? "\u00a0" : null}
      {displayName ? (
        <span className="font-normal opacity-80">{displayName}</span>
      ) : null}
    </span>
  );
}

/** Compact list label: time, then service name (date is implied by the cell). */
export function formatMonthEventLabel(event: CalendarEvent): string {
  const when = format(event.start, "HH:mm");
  return `${when}  ${event.title}`;
}

type Props<T> = {
  event: CalendarEvent<T>;
  onClick?: (event: CalendarEvent<T>) => void;
  variant?: CalendarEventCardVariant;
  dense?: boolean;
  /** Explicit block height (e.g. from service duration). */
  height?: number;
  renderHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function detailBody<T>(
  event: CalendarEvent<T>,
  renderHoverContent?: (event: CalendarEvent<T>) => ReactNode,
): ReactNode {
  if (renderHoverContent) return renderHoverContent(event);

  const when = format(event.start, "HH:mm");

  if (event.hoverLines?.length) {
    return (
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs">{when}</p>
        <p className="text-sm font-semibold leading-tight">{event.title}</p>
        {event.subtitle ? (
          <p className="text-muted-foreground text-xs">{event.subtitle}</p>
        ) : null}
        {event.hoverLines.map((line) => (
          <p key={line} className="text-muted-foreground text-xs leading-snug">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs">{when}</p>
      <p className="text-sm font-semibold leading-tight">{event.title}</p>
      {event.subtitle ? (
        <p className="text-muted-foreground text-xs">{event.subtitle}</p>
      ) : null}
    </div>
  );
}

function wrapHover<T>(
  card: React.ReactElement,
  event: CalendarEvent<T>,
  variant: CalendarEventCardVariant,
  renderHoverContent?: (event: CalendarEvent<T>) => ReactNode,
) {
  const body = detailBody(event, renderHoverContent);
  if (!body) return card;

  const isDay = variant === "day";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-3"
        side={isDay ? "top" : "right"}
        align="start"
        sideOffset={8}
      >
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}

function defaultHeightForVariant(
  variant: CalendarEventCardVariant,
  dense: boolean,
): number {
  if (dense && variant === "week") return FIXED_EVENT_HEIGHT_DENSE_PX;
  if (variant === "day") return FIXED_EVENT_HEIGHT_DAY_PX;
  if (variant === "month") return 18;
  return FIXED_EVENT_HEIGHT_PX;
}

export function CalendarEventCard<T>({
  event,
  onClick,
  variant = "week",
  dense = false,
  height: heightProp,
  renderHoverContent,
  className,
  style,
}: Props<T>) {
  const isDay = variant === "day";
  const isMonth = variant === "month";
  const height = heightProp ?? defaultHeightForVariant(variant, dense);
  const isCompact =
    !isMonth && height < APPOINTMENT_CARD_SUBTITLE_MIN_HEIGHT_PX;
  const showSubtitle =
    Boolean(event.subtitle || event.subtitleLead) && !isCompact;
  const subtitleAria = [event.subtitleLead, event.subtitle]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (isMonth) {
    const label = formatMonthEventLabel(event);
    const serviceHex = normalizeServiceColor(event.serviceColor);
    const card = (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(event);
        }}
        className={cn(
          "flex w-full min-w-0 shrink-0 items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] font-medium leading-tight",
          "hover:bg-accent/40 transition-colors",
          className,
        )}
        style={style}
        aria-label={label}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            !serviceHex &&
              (event.status != null
                ? (APPOINTMENT_STATUS_DOT_CLASS[event.status] ??
                  "bg-foreground/50")
                : "bg-foreground/50"),
          )}
          style={serviceHex ? { backgroundColor: serviceHex } : undefined}
          aria-hidden
        />
        <span className="text-foreground min-w-0 truncate font-medium">
          {event.title}
        </span>
      </button>
    );

    return wrapHover(card, event, variant, renderHoverContent);
  }

  const colorStyle = serviceColorToCardStyle(event.serviceColor);
  const colorClass = colorStyle
    ? "border text-current"
    : (event.colorClass ??
      "bg-gradient-to-b from-slate-400 to-slate-500 text-white border-slate-400/60 hover:from-slate-400 hover:to-slate-500");

  const card = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "relative flex h-full w-full min-h-0 min-w-0 flex-col justify-center overflow-hidden rounded-md border text-left shadow-sm",
        "transition-shadow duration-200 hover:shadow",
        isCompact
          ? "px-1.5 py-px"
          : isDay
            ? "gap-0.5 px-2 py-1"
            : "gap-0 px-1.5 py-0.5",
        colorClass,
        className,
      )}
      style={{
        ...(heightProp == null ? { height, minHeight: height } : undefined),
        ...(colorStyle
          ? {
              background: colorStyle.background,
              borderColor: colorStyle.borderColor,
              color: colorStyle.color,
            }
          : undefined),
        ...style,
      }}
      aria-label={
        showSubtitle && subtitleAria
          ? `${event.title}, ${subtitleAria}`
          : event.title
      }
    >
      <EventLabel
        text={event.title}
        className={cn(
          "relative z-[1] w-full min-w-0 shrink-0 font-semibold",
          isCompact
            ? isDay
              ? "text-[11px]"
              : "text-[10px]"
            : isDay
              ? "text-xs"
              : "text-[10px]",
        )}
      />
      {showSubtitle ? (
        <PatientSubtitle
          lead={event.subtitleLead}
          name={event.subtitle}
          className={cn(
            "relative z-[1] w-full shrink-0",
            isDay ? "text-[11px]" : "text-[9px]",
          )}
        />
      ) : null}
    </button>
  );

  return wrapHover(card, event, variant, renderHoverContent);
}
