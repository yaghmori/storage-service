"use client"

import { useRender } from "@base-ui/react/use-render"
import * as React from "react"

/**
 * Drop-in replacement for `@radix-ui/react-slot`'s `<Slot />` component.
 * Merges its own props onto the single child element using Base UI's
 * `useRender` hook so that consumers using the `asChild` pattern continue
 * to work after the Radix → Base UI migration.
 */
function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
}) {
  const renderProp = React.isValidElement(children) ? children : undefined

  return useRender({
    render: renderProp ?? <span />,
    props: props as Record<string, unknown>,
  })
}

export { Slot }
