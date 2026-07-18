/**
 * Shared surface + invalid styles so selects, date pickers, and combobox
 * triggers match standard Input (`aria-invalid` red border/bg).
 */
export const fieldControlSurfaceClass =
  "border-input bg-[#F9FAFB] dark:bg-[#111827]";

export const fieldControlInvalidClass =
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:bg-[#FDF2F2]";
