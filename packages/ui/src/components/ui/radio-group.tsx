"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

type LegacyRadioGroupProps = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive>,
  "onValueChange"
> & {
  /**
   * Backwards-compatible signature: receives only the new value.
   * Base UI's native signature `(value, eventDetails)` is also supported.
   */
  onValueChange?: (
    value: string,
    eventDetails?: { event: Event; cancel: () => void }
  ) => void
}

function RadioGroup({
  className,
  onValueChange,
  ...props
}: LegacyRadioGroupProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      onValueChange={
        onValueChange
          ? ((value: unknown, eventDetails: unknown) => {
              onValueChange(
                value as string,
                eventDetails as { event: Event; cancel: () => void }
              )
            }) as never
          : undefined
      }
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="bg-primary block size-2 rounded-full"
      />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
