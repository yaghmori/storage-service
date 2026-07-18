"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import * as React from "react"

import { resolveRender } from "@workspace/ui/lib/as-child"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

type CollapsibleTriggerProps = Omit<
  React.ComponentProps<typeof CollapsiblePrimitive.Trigger>,
  "render"
> & {
  asChild?: boolean
  render?: React.ReactElement
}

function CollapsibleTrigger({
  asChild,
  render,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const renderProp = resolveRender(asChild, children, render)
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      render={renderProp}
      {...props}
    >
      {renderProp ? undefined : children}
    </CollapsiblePrimitive.Trigger>
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
