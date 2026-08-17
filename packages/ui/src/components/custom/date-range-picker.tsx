"use client";

import {
  endOfDay,
  format,
  isValid,
  parse,
  startOfDay,
  subMinutes,
} from "date-fns";
import { CalendarIcon, XCircle } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Label } from "@workspace/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";

export interface DateRangePreset {
  key: string;
  label: string;
  /** Window length in minutes, measured back from the moment it is picked. */
  minutes: number;
}

export interface DateRangeValue {
  from: Date;
  to: Date;
  /** Key of the preset the range came from, so the label can stay relative. */
  preset?: string;
}

export const DEFAULT_DATE_RANGE_PRESETS: DateRangePreset[] = [
  { key: "30m", label: "Last 30 minutes", minutes: 30 },
  { key: "1h", label: "Last 1 hour", minutes: 60 },
  { key: "6h", label: "Last 6 hours", minutes: 60 * 6 },
  { key: "12h", label: "Last 12 hours", minutes: 60 * 12 },
  { key: "24h", label: "Last 24 hours", minutes: 60 * 24 },
  { key: "7d", label: "Last 7 days", minutes: 60 * 24 * 7 },
  { key: "30d", label: "Last 30 days", minutes: 60 * 24 * 30 },
];

const DATE_TIME_INPUT_FORMAT = "yyyy-MM-dd HH:mm";
const DATE_INPUT_FORMAT = "yyyy-MM-dd";
const DATE_TIME_DISPLAY_FORMAT = "MMM d, yyyy HH:mm";
const DATE_DISPLAY_FORMAT = "MMM d, yyyy";

interface DraftRange {
  from?: Date;
  to?: Date;
  preset?: string;
}

function formatDatePart(date: Date | undefined, pattern: string) {
  return date && isValid(date) ? format(date, pattern) : "";
}

function parseDatePart(text: string, pattern: string): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const parsed = parse(trimmed, pattern, new Date());
  return isValid(parsed) ? parsed : undefined;
}

interface DateTextFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  onValueChange: (value: string) => void;
}

function DateTextField({
  id,
  label,
  value,
  placeholder,
  invalid,
  onValueChange,
}: DateTextFieldProps) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div
        className={cn(
          "flex h-9 w-full items-center overflow-hidden rounded-md border border-input shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
          invalid &&
            "border-destructive focus-within:border-destructive focus-within:ring-destructive/20 dark:focus-within:ring-destructive/40",
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-full w-9 shrink-0 items-center justify-center border-e border-input text-muted-foreground"
        >
          <CalendarIcon className="size-4" />
        </span>
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

export interface DateRangePickerProps {
  value?: DateRangeValue;
  onChange: (value: DateRangeValue | undefined) => void;
  /** Static prefix shown on the trigger, e.g. the column name. */
  title?: string;
  /** Shown on the trigger while no range is selected. */
  placeholder?: string;
  presets?: DateRangePreset[];
  showPresets?: boolean;
  /** Include time of day in the inputs and labels. */
  showTime?: boolean;
  numberOfMonths?: number;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  /** Extra classes for the trigger button. */
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  title,
  placeholder = "Select date range",
  presets = DEFAULT_DATE_RANGE_PRESETS,
  showPresets = true,
  showTime = true,
  numberOfMonths = 1,
  align = "start",
  disabled,
  className,
}: DateRangePickerProps) {
  const inputFormat = showTime ? DATE_TIME_INPUT_FORMAT : DATE_INPUT_FORMAT;
  const displayFormat = showTime
    ? DATE_TIME_DISPLAY_FORMAT
    : DATE_DISPLAY_FORMAT;

  const fieldId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftRange>(() => value ?? {});
  const [fromText, setFromText] = React.useState(() =>
    formatDatePart(value?.from, inputFormat),
  );
  const [toText, setToText] = React.useState(() =>
    formatDatePart(value?.to, inputFormat),
  );

  const syncDraft = React.useCallback(
    (next: DraftRange) => {
      setDraft(next);
      setFromText(formatDatePart(next.from, inputFormat));
      setToText(formatDatePart(next.to, inputFormat));
    },
    [inputFormat],
  );

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) syncDraft(value ?? {});
    },
    [syncDraft, value],
  );

  const commit = React.useCallback(
    (next: DateRangeValue | undefined) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  const onPresetSelect = React.useCallback(
    (preset: DateRangePreset) => {
      const to = new Date();
      commit({ from: subMinutes(to, preset.minutes), to, preset: preset.key });
    },
    [commit],
  );

  const onCalendarSelect = React.useCallback(
    (range: DateRange | undefined) => {
      syncDraft({
        from: range?.from ? startOfDay(range.from) : undefined,
        to: range?.to ? endOfDay(range.to) : undefined,
      });
    },
    [syncDraft],
  );

  const onFromTextChange = React.useCallback(
    (text: string) => {
      setFromText(text);
      setDraft((prev) => ({
        ...prev,
        from: parseDatePart(text, inputFormat),
        preset: undefined,
      }));
    },
    [inputFormat],
  );

  const onToTextChange = React.useCallback(
    (text: string) => {
      setToText(text);
      setDraft((prev) => ({
        ...prev,
        to: parseDatePart(text, inputFormat),
        preset: undefined,
      }));
    },
    [inputFormat],
  );

  const onApply = React.useCallback(() => {
    if (!draft.from || !draft.to) return;
    const from = showTime ? draft.from : startOfDay(draft.from);
    const to = showTime ? draft.to : endOfDay(draft.to);
    const inOrder = from <= to;
    commit({
      from: inOrder ? from : to,
      to: inOrder ? to : from,
      preset: draft.preset,
    });
  }, [commit, draft, showTime]);

  const onClear = React.useCallback(() => {
    syncDraft({});
    commit(undefined);
  }, [commit, syncDraft]);

  const onTriggerReset = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      syncDraft({});
      onChange(undefined);
    },
    [onChange, syncDraft],
  );

  const describeRange = React.useCallback(
    (range: DateRangeValue | DraftRange | undefined) => {
      if (!range?.from || !range.to) return undefined;
      const preset = range.preset
        ? presets.find((item) => item.key === range.preset)
        : undefined;
      if (preset) return preset.label;
      return `${format(range.from, displayFormat)} – ${format(range.to, displayFormat)}`;
    },
    [displayFormat, presets],
  );

  const triggerLabel = describeRange(value);
  const draftLabel = describeRange(draft);
  const fromInvalid = fromText.trim().length > 0 && !draft.from;
  const toInvalid = toText.trim().length > 0 && !draft.to;
  const canApply = Boolean(draft.from && draft.to);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("border-dashed", className)}
        >
          {triggerLabel ? (
            <span
              role="button"
              aria-label="Clear date range"
              tabIndex={0}
              onClick={onTriggerReset}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <XCircle />
            </span>
          ) : (
            <CalendarIcon />
          )}
          <span className="flex items-center gap-2">
            <span>{title ?? placeholder}</span>
            {triggerLabel && (
              <>
                <Separator
                  orientation="vertical"
                  className="mx-0.5 data-[orientation=vertical]:h-4"
                />
                <span>{triggerLabel}</span>
              </>
            )}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-auto sm:min-w-[550px] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="border-b p-3">
          <p className="truncate text-[0.8rem] text-muted-foreground">
            {draftLabel ? `Custom range: ${draftLabel}` : placeholder}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row ">
          <Calendar
            mode="range"
            selected={{ from: draft.from, to: draft.to }}
            onSelect={onCalendarSelect}
            defaultMonth={draft.from ?? draft.to ?? new Date()}
            numberOfMonths={numberOfMonths}
            className="px-6 py-3 [--cell-size:--spacing(8)]"
            classNames={{
              month: "flex flex-col w-full gap-2",
              month_caption:
                "flex items-center justify-start h-(--cell-size) w-full",
              nav: "flex items-center gap-1 absolute top-0 end-0 justify-end",
              caption_label: "select-none text-[0.8rem] font-medium",
              weekday:
                "text-muted-foreground rounded-md flex-1 font-normal text-[0.7rem] select-none",
              week: "flex w-full mt-0.5",
            }}
          />

          {showPresets && (
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto border-t p-3 sm:max-h-none sm:w-56 sm:border-t-0 sm:border-s">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  data-active={draft.preset === preset.key}
                  onClick={() => onPresetSelect(preset)}
                  className="w-full rounded-md px-3 py-2 text-start text-sm whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[active=true]:bg-accent data-[active=true]:font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
          <DateTextField
            id={`${fieldId}-from`}
            label="Start"
            value={fromText}
            placeholder={inputFormat}
            invalid={fromInvalid}
            onValueChange={onFromTextChange}
          />
          <DateTextField
            id={`${fieldId}-to`}
            label="End"
            value={toText}
            placeholder={inputFormat}
            invalid={toInvalid}
            onValueChange={onToTextChange}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 text-sm"
            onClick={onClear}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="h-9 px-4 text-sm"
            disabled={!canApply}
            onClick={onApply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
