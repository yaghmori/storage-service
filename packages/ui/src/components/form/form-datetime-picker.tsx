import type { ComponentProps } from "react";

import { DateTimePicker } from "@workspace/ui/components";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormDateTimePickerProps = FormControlProps &
  Omit<ComponentProps<typeof DateTimePicker>, "date" | "onDateChange"> & {
    children?: React.ReactNode;
  };

export function FormDateTimePicker({
  children,
  label,
  description,
  horizontal,
  controlFirst,
  showError,
  ...props
}: FormDateTimePickerProps) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  const showTime = props.showTime ?? false;

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      if (showTime) {
        field.handleChange(date.toISOString());
      } else {
        // Use local date methods to avoid timezone shift
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        field.handleChange(`${year}-${month}-${day}`);
      }
    } else {
      field.handleChange("");
    }
    field.handleBlur();
  };

  // Parse value for display: YYYY-MM-DD as local date to avoid timezone shift
  const raw = field.state.value;
  const dateValue =
    !raw || (typeof raw === 'string' && raw.trim() === '')
      ? undefined
      : typeof raw === 'string' && raw.length === 10
        ? (() => {
            const [y, m, d] = raw.split('-').map(Number);
            const d2 = new Date(y, m - 1, d);
            return isNaN(d2.getTime()) ? undefined : d2;
          })()
        : (() => {
            const d2 = new Date(raw);
            return isNaN(d2.getTime()) ? undefined : d2;
          })();

  return (
    <FormBase
      label={label}
      description={description}
      horizontal={horizontal}
      controlFirst={controlFirst}
      showError={showError}
    >
      <DateTimePicker
        date={dateValue}
        onDateChange={handleDateChange}
        disabled={props.disabled}
        placeholder={props.placeholder}
        showTime={showTime}
        className={props.className}
        id={field.name}
        onBlur={field.handleBlur}
        aria-invalid={isInvalid}
      />
      {children}
    </FormBase>
  );
}
