"use client";

import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  fieldControlInvalidClass,
  fieldControlSurfaceClass,
} from "@workspace/ui/lib/field-control-styles";
import { cn } from "@workspace/ui/lib/utils";

interface DateTimePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showTime?: boolean;
  "aria-invalid"?: boolean;
  id?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

export function DateTimePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  showTime = true,
  "aria-invalid": ariaInvalid,
  id,
  onBlur,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    date,
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00",
  );

  React.useEffect(() => {
    setSelectedDate(date);
    if (date) {
      setTimeValue(format(date, "HH:mm"));
    }
  }, [date]);

  const handleDateSelect = (day: Date | undefined) => {
    if (!day) {
      setSelectedDate(undefined);
      onDateChange?.(undefined);
      return;
    }

    const newDate = new Date(day);

    // If we have a time value, apply it to the new date
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    }

    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    setTimeValue(time);

    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      setSelectedDate(newDate);
      onDateChange?.(newDate);
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    setTimeValue("00:00");
    onDateChange?.(undefined);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          onBlur={onBlur}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-start text-left font-normal shadow-xs",
            fieldControlSurfaceClass,

            fieldControlInvalidClass,
            !selectedDate && !ariaInvalid && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            showTime ? (
              format(selectedDate, "PPP 'at' p")
            ) : (
              format(selectedDate, "PPP")
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            captionLayout="dropdown"
          />
          {showTime && (
            <div className="border-t p-3 space-y-2">
              <Label className="text-sm font-medium">Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={timeValue}
                  onChange={handleTimeChange}
                  className="flex-1"
                  disabled={!selectedDate}
                />
              </div>
              {selectedDate && (
                <Button
                  variant="ghost"
                  className="w-full"
                  size="sm"
                  onClick={handleClear}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
