import * as React from "react"

/**
 * Backwards-compat shim that converts the legacy `asChild` prop (Radix style)
 * into Base UI's `render` prop pattern.
 *
 * Usage in a wrapper component:
 * ```tsx
 * function MyTrigger({ asChild, render, children, ...props }) {
 *   return (
 *     <BaseUITrigger
 *       render={resolveRender(asChild, children, render)}
 *       {...props}
 *     >
 *       {asChild || render ? undefined : children}
 *     </BaseUITrigger>
 *   )
 * }
 * ```
 */
export function resolveRender(
  asChild: boolean | undefined,
  children: React.ReactNode,
  render: unknown
): React.ReactElement | undefined {
  if (render !== undefined) {
    return render as React.ReactElement
  }
  if (asChild && React.isValidElement(children)) {
    return children
  }
  return undefined
}
