import type { ComponentProps } from "react";

import { Input } from "@workspace/ui/components/input";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormInputProps = FormControlProps &
  Omit<
    ComponentProps<typeof Input>,
    | "id"
    | "name"
    | "value"
    | "defaultValue"
    | "onBlur"
    | "onChange"
    | "aria-invalid"
  >;

export function FormInput({
  children,
  label,
  description,
  horizontal,
  controlFirst,
  showError,
  ...props
}: FormInputProps) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  // HTML inputs always return strings; coerce number inputs so form state and validation get numbers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.type === "number") {
      const raw = e.target.value;
      if (raw === "") {
        field.handleChange(undefined as unknown as string);
      } else {
        const n = Number(raw);
        field.handleChange((isNaN(n) ? undefined : n) as unknown as string);
      }
    } else {
      field.handleChange(e.target.value);
    }
  };

  const displayValue =
    props.type === "number" && (field.state.value === undefined || field.state.value === null)
      ? ""
      : props.type === "number"
        ? String(field.state.value ?? "")
        : field.state.value ?? "";

  return (
    <FormBase
      label={label}
      description={description}
      horizontal={horizontal}
      controlFirst={controlFirst}
      showError={showError}
    >
      <div className="flex items-center gap-2 ">
        <Input
          id={field.name}
          name={field.name}
          // Ensure we never pass `null` to the underlying input to avoid React warnings
          value={displayValue}
          onBlur={field.handleBlur}
          onChange={handleChange}
          aria-invalid={isInvalid}
          {...props}
        />
        {children}
      </div>
    </FormBase>
  );
}
