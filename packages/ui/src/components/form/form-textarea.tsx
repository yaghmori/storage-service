import type { ComponentProps } from "react";

import { Textarea } from "@workspace/ui/components/textarea";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormTextareaProps = FormControlProps &
  Omit<
    ComponentProps<typeof Textarea>,
    | "id"
    | "name"
    | "value"
    | "defaultValue"
    | "onBlur"
    | "onChange"
    | "aria-invalid"
  >;

export function FormTextarea({
  label,
  description,
  horizontal,
  controlFirst,
  showError,
  ...props
}: FormTextareaProps) {
  const field = useFieldContext<string | null | undefined>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <FormBase
      label={label}
      description={description}
      horizontal={horizontal}
      controlFirst={controlFirst}
      showError={showError}
    >
      <Textarea
        id={field.name}
        name={field.name}
        // Never pass `null` to textarea — React requires "" for controlled empty
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        {...props}
      />
    </FormBase>
  );
}
