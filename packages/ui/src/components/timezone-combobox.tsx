"use client";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import * as React from "react";

// Common timezones list
const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

interface TimezoneComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function TimezoneCombobox({
  value,
  onValueChange,
  className,
}: TimezoneComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Get all available timezones or use the common list
  const allTimezones = React.useMemo(() => {
    try {
      if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
        const supportedValuesOf = (
          Intl as unknown as { supportedValuesOf: (key: string) => string[] }
        ).supportedValuesOf;
        if (typeof supportedValuesOf === "function") {
          return supportedValuesOf("timeZone").sort();
        }
      }
    } catch {
      // Fallback to common timezones
    }
    return timezones;
  }, []);

  const displayValue = value || "Select timezone...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="truncate">{displayValue}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {allTimezones.map((tz: string) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onValueChange?.(tz);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tz ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {tz}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
