"use client";

import { Button, Tabs, TabsList, TabsTrigger } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { BusinessHours, CalendarView } from "./types";
import { getToolbarLabel } from "./utils";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

type Props = {
  date: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  businessHours?: BusinessHours;
  timeZone?: string;
  /** Rendered next to the Day/Week/Month/Year tabs. */
  toolbarEnd?: ReactNode;
  className?: string;
};

export function EventCalendarToolbar({
  date,
  view,
  onViewChange,
  onNavigate,
  onToday,
  businessHours,
  timeZone,
  toolbarEnd,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "border-b pb-3",
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {toolbarEnd}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onNavigate("prev")}
              aria-label="Previous period"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <h2 className="text-base hover:bg-muted-foreground/10 rounded-md font-semibold px-1 sm:text-md">
              {getToolbarLabel(date, view, businessHours, timeZone)}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onNavigate("next")}
              aria-label="Next period"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
        </div>
        <Tabs
          value={view}
          onValueChange={(v: string) => onViewChange(v as CalendarView)}
        >
          <TabsList>
            {VIEW_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
