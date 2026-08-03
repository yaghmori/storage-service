"use client";

import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TimezoneCombobox,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface TimeSlot {
  time: string;
  available: boolean;
  /** Optional available room count for this slot (UI only until wired). */
  availableRooms?: number;
}

export interface AvailableDate {
  date: number;
  hasSlots: boolean;
}

export interface AppointmentSchedulerProps {
  meetingTitle: string;
  description?: string;
  shortDescription?: string;
  features?: string[];
  duration: string;
  timezone: string;
  availableDates: AvailableDate[];
  timeSlots: TimeSlot[];
  onDateSelect?: (date: number) => void;
  onTimeSelect?: (time: string) => void;
  onTimezoneChange?: (timezone: string) => void;
  selectedDate?: number;
  selectedTime?: string;
  selectedFullDate?: Date; // Full date object for display when in different month
  currentMonth?: number;
  currentYear?: number;
  onMonthChange?: (month: number, year: number) => void;
}

export function AppointmentScheduler({
  meetingTitle,
  description,
  shortDescription,
  features,
  duration,
  timezone,
  availableDates,
  timeSlots,
  onDateSelect,
  onTimeSelect,
  onTimezoneChange,
  selectedDate: controlledSelectedDate,
  selectedTime: controlledSelectedTime,
  selectedFullDate,
  currentMonth: controlledCurrentMonth,
  currentYear: controlledCurrentYear,
  onMonthChange,
}: AppointmentSchedulerProps) {
  const now = new Date();
  const [internalCurrentMonth, setInternalCurrentMonth] = useState(
    now.getMonth()
  );
  const [internalCurrentYear, setInternalCurrentYear] = useState(
    now.getFullYear()
  );
  const [internalSelectedDate, setInternalSelectedDate] = useState<number | undefined>(undefined);
  const [internalSelectedTime, setInternalSelectedTime] = useState<string | undefined>(undefined);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const timeSlotsRef = useRef<HTMLDivElement>(null);

  // Use controlled or internal state
  const currentMonth = controlledCurrentMonth ?? internalCurrentMonth;
  const currentYear = controlledCurrentYear ?? internalCurrentYear;
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const selectedTime = controlledSelectedTime ?? internalSelectedTime;

  // Sync internal date state with controlled prop
  useEffect(() => {
    if (controlledSelectedDate !== undefined) {
      setInternalSelectedDate(controlledSelectedDate);
    } else if (controlledSelectedDate === undefined) {
      setInternalSelectedDate(undefined);
    }
  }, [controlledSelectedDate]);

  // Sync internal time state with controlled prop
  useEffect(() => {
    if (controlledSelectedTime !== undefined) {
      setInternalSelectedTime(controlledSelectedTime);
    } else if (controlledSelectedTime === undefined) {
      setInternalSelectedTime(undefined);
    }
  }, [controlledSelectedTime]);

  // Scroll to time slots when date is selected (especially on mobile)
  useEffect(() => {
    if (selectedDate && timeSlotsRef.current) {
      // Check if device is mobile/tablet (less than lg breakpoint - 1024px)
      const isMobileOrTablet =
        typeof window !== "undefined" && window.innerWidth < 1024;

      if (isMobileOrTablet) {
        setTimeout(() => {
          timeSlotsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 300);
      }
    }
  }, [selectedDate]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      const newMonth = 11;
      const newYear = currentYear - 1;
      if (onMonthChange) {
        onMonthChange(newMonth, newYear);
      } else {
        setInternalCurrentMonth(newMonth);
        setInternalCurrentYear(newYear);
      }
    } else {
      const newMonth = currentMonth - 1;
      if (onMonthChange) {
        onMonthChange(newMonth, currentYear);
      } else {
        setInternalCurrentMonth(newMonth);
      }
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      const newMonth = 0;
      const newYear = currentYear + 1;
      if (onMonthChange) {
        onMonthChange(newMonth, newYear);
      } else {
        setInternalCurrentMonth(newMonth);
        setInternalCurrentYear(newYear);
      }
    } else {
      const newMonth = currentMonth + 1;
      if (onMonthChange) {
        onMonthChange(newMonth, currentYear);
      } else {
        setInternalCurrentMonth(newMonth);
      }
    }
  };

  const handleDateClick = (date: number) => {
    const isAvailable = availableDates.find(
      (d) => d.date === date && d.hasSlots
    );
    if (isAvailable) {
      if (!controlledSelectedDate) {
        setInternalSelectedDate(date);
      }
      onDateSelect?.(date);
    }
  };

  const handleTimeClick = (time: string) => {
    if (!controlledSelectedTime) {
      setInternalSelectedTime(time);
    }
    onTimeSelect?.(time);
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Check if selected date is in different month
  const isSelectedDateInDifferentMonth = useMemo(() => {
    if (!selectedFullDate) return false;
    return (
      selectedFullDate.getMonth() !== currentMonth ||
      selectedFullDate.getFullYear() !== currentYear
    );
  }, [selectedFullDate, currentMonth, currentYear]);

  const handleNavigateToSelectedDate = () => {
    if (selectedFullDate && onMonthChange) {
      onMonthChange(
        selectedFullDate.getMonth(),
        selectedFullDate.getFullYear()
      );
    }
  };

  const getSelectedDayName = () => {
    // Use full date if provided (for dates in different months), otherwise use current month/year
    if (selectedFullDate) {
      return selectedFullDate.toLocaleDateString("en-US", { weekday: "short" });
    }
    if (!selectedDate) return "";
    const date = new Date(currentYear, currentMonth, selectedDate);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getSelectedDateFormatted = () => {
    // Use full date if provided (for dates in different months), otherwise use current month/year
    if (selectedFullDate) {
      return selectedFullDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: isSelectedDateInDifferentMonth ? "numeric" : undefined,
      });
    }
    if (!selectedDate) return "";
    const date = new Date(currentYear, currentMonth, selectedDate);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (time: string) => {
    if (timeFormat === "24h") return time;

    const [hours, minutes] = time.split(":");
    const hour = Number.parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl gap-0 lg:items-stretch">
      {/* Left Panel - Service Info (order-3 on mobile, order-1 on desktop) */}
      <div className="order-3 lg:order-1 py-6 w-full lg:w-60  space-y-6 flex flex-col">
        <div className="space-y-5 animate-fade-in">
          {/* Headline */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {meetingTitle}
            </h2>
            {shortDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {shortDescription}
              </p>
            )}
          </div>

          {/* What You'll Get */}
          {features && features.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                What You&apos;ll Get
              </h3>
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Service Description */}
          {description && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">
                About This Service
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          )}

          {/* Duration and Timezone */}
          <div className="space-y-3 text-sm text-muted-foreground pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{duration}</span>
            </div>

            <div className="flex flex-col items-start gap-2">
              <label className="text-xs font-medium text-foreground">
                Timezone
              </label>
              <TimezoneCombobox
                value={timezone}
                onValueChange={onTimezoneChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Center Panel - Calendar (order-1 on mobile, order-2 on desktop) */}
      <div className="order-1 py-6 lg:order-2 flex-1 md:p-6 flex flex-col lg:overflow-hidden">
        <div className="space-y-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
          {/* Month Navigation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between animate-fade-in">
              <h3 className="text-xl font-medium text-foreground">
                {monthNames[currentMonth]}{" "}
                <span className="text-muted-foreground">{currentYear}</span>
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isSelectedDateInDifferentMonth && selectedFullDate && (
              <div className="flex items-center gap-2 rounded-lg bg-muted border border-border px-3 py-2 text-xs">
                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Selected date:{" "}
                  {selectedFullDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateToSelectedDate}
                  className="ml-auto h-6 px-2 text-xs"
                >
                  View
                </Button>
              </div>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 p-1">
            {/* Day Headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} />;
              }

              const isAvailable = availableDates.find(
                (d) => d.date === day && d.hasSlots
              );
              const isSelected = day === selectedDate;
              const hasIndicator = isAvailable && !isSelected;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  disabled={!isAvailable}
                  className={cn(
                    "relative aspect-square rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:scale-105 active:scale-95 cursor-pointer",
                    isSelected &&
                    "bg-primary text-primary-foreground shadow-lg scale-105",
                    !isSelected &&
                    isAvailable &&
                    "bg-muted text-foreground hover:bg-primary/10",
                    !isAvailable &&
                    "text-muted-foreground/30 cursor-not-allowed",
                    "animate-fade-in"
                  )}
                  style={{
                    animationDelay: `${index * 10}ms`,
                  }}
                >
                  {day}
                  {hasIndicator && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Panel - Time Slots (order-2 on mobile, order-3 on desktop) */}
      <div
        ref={timeSlotsRef}
        className="order-2 py-6 lg:order-3 w-full lg:w-60 flex flex-col overflow-hidden"
      >
        {/* Selected Date Info */}
        <div className="space-y-3 mb-4 flex-shrink-0">
          {selectedFullDate ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xl">
                    <span className="font-medium text-foreground">
                      {getSelectedDayName()}
                    </span>
                    <span className="text-muted-foreground">
                      , {getSelectedDateFormatted()}
                    </span>
                  </div>
                  {isSelectedDateInDifferentMonth && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected date is in a different month
                    </p>
                  )}
                </div>
                <Tabs
                  value={timeFormat}
                  onValueChange={(v: string) =>
                    setTimeFormat(v as "12h" | "24h")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="12h">12h</TabsTrigger>
                    <TabsTrigger value="24h">24h</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {isSelectedDateInDifferentMonth && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigateToSelectedDate}
                  className="w-full text-xs"
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  Go to selected date
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Select a date first
              </div>
              <Tabs
                value={timeFormat}
                onValueChange={(v: string) => setTimeFormat(v as "12h" | "24h")}
              >
                <TabsList>
                  <TabsTrigger value="12h">12h</TabsTrigger>
                  <TabsTrigger value="24h">24h</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {/* Time Slots */}
        <div className="space-y-2 overflow-y-auto px-1 scrollbar-thin max-h-[550px] lg:flex-1 lg:min-h-0 lg:overflow-auto">
          {timeSlots.map((slot, index) => {
            const isSelected = slot.time === selectedTime;
            const roomCount = slot.availableRooms;
            return (
              <button
                key={slot.time}
                onClick={() => handleTimeClick(slot.time)}
                disabled={!slot.available}
                className={cn(
                  "flex w-full items-center justify-between gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isSelected &&
                  "bg-primary text-primary-foreground shadow-lg scale-[1.02]",
                  !isSelected &&
                  slot.available &&
                  "bg-muted text-foreground hover:bg-primary/10",
                  !slot.available &&
                  "text-muted-foreground/40 cursor-not-allowed",
                  "animate-fade-in"
                )}
                style={{
                  animationDelay: `${index * 30}ms`,
                }}
              >
                <span>{formatTime(slot.time)}</span>
                {roomCount != null ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : slot.available
                          ? "bg-background/80 text-muted-foreground"
                          : "bg-muted text-muted-foreground/50",
                    )}
                    title={`${roomCount} room${roomCount === 1 ? "" : "s"} available`}
                  >
                    {roomCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
