"use client"

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

type LegacyAccordionProps = Omit<
  React.ComponentProps<typeof AccordionPrimitive.Root>,
  "defaultValue" | "value" | "onValueChange"
> & {
  /**
   * @deprecated Use `multiple` (boolean) instead. Kept for backwards-compat
   * with the previous Radix-based API.
   */
  type?: "single" | "multiple"
  /**
   * @deprecated Always collapsible in Base UI. Prop is accepted but ignored.
   */
  collapsible?: boolean
  defaultValue?: string | readonly string[]
  value?: string | readonly string[]
  onValueChange?:
    | ((value: string) => void)
    | ((value: string[]) => void)
    | ((value: string | string[]) => void)
}

function Accordion({
  type,
  collapsible: _collapsible,
  multiple,
  defaultValue,
  value,
  onValueChange,
  ...props
}: LegacyAccordionProps) {
  const isMultiple = multiple ?? type === "multiple"

  const normalizedDefaultValue = React.useMemo<readonly unknown[] | undefined>(
    () =>
      Array.isArray(defaultValue)
        ? defaultValue
        : typeof defaultValue === "string" && defaultValue.length > 0
          ? [defaultValue]
          : undefined,
    [defaultValue]
  )

  const normalizedValue = React.useMemo<readonly unknown[] | undefined>(
    () =>
      Array.isArray(value)
        ? value
        : typeof value === "string"
          ? [value]
          : undefined,
    [value]
  )

  const handleValueChange = React.useCallback(
    (next: unknown[]) => {
      if (!onValueChange) return
      if (type === "single" || (!isMultiple && type !== "multiple")) {
        ;(onValueChange as (v: string) => void)((next[0] as string) ?? "")
      } else {
        ;(onValueChange as (v: string[]) => void)(next as string[])
      }
    },
    [onValueChange, type, isMultiple]
  )

  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      multiple={isMultiple}
      defaultValue={normalizedDefaultValue as never}
      value={normalizedValue as never}
      onValueChange={onValueChange ? (handleValueChange as never) : undefined}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-[transform,rotate] duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-[var(--accordion-panel-height)] overflow-hidden text-sm transition-[height] duration-200 ease-in-out data-[ending-style]:h-0 data-[starting-style]:h-0"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
