import * as React from "react";

import {
  fieldControlInvalidClass,
  fieldControlSurfaceClass,
} from "@workspace/ui/lib/field-control-styles";
import { cn } from "@workspace/ui/lib/utils";

// Props extended to support optional start/end adornments
interface InputProps extends React.ComponentProps<"input"> {
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Usage example:
 * <Input startAdornment={<Icons.Search className="h-4 w-4 text-muted-foreground" />} placeholder="Search..." />
 */
function Input({
  className,
  type,
  startAdornment,
  endAdornment,
  children,
  ...props
}: InputProps) {
  // If adornments are present, wrap in a relative container and absolutely position the icon(s)
  if (startAdornment || endAdornment) {
    return (
      <div className={cn("relative w-full", className)}>
        {startAdornment && (
          <span
            className="pointer-events-none absolute top-1/2 left-0 flex -translate-y-1/2 items-center pl-3 select-none"
            aria-hidden="true"
          >
            {startAdornment}
          </span>
        )}
        <input
          type={type}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-primary",
            fieldControlSurfaceClass,
            fieldControlInvalidClass,
            startAdornment ? "pl-10" : "",
            endAdornment ? "pr-10" : "",
          )}
          {...props}
        />
        {endAdornment && (
          <span
            className="pointer-events-none absolute top-1/2 right-0 flex -translate-y-1/2 items-center pr-3 select-none"
            aria-hidden="true"
          >
            {endAdornment}
          </span>
        )}
        {children}
      </div>
    );
  }
  // Default: no adornments
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        fieldControlSurfaceClass,
        fieldControlInvalidClass,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
