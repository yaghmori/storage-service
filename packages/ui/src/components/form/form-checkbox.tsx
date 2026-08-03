import type { ComponentProps } from "react";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormCheckboxProps = FormControlProps &
  Omit<
    ComponentProps<typeof Checkbox>,
    | "id"
    | "name"
    | "checked"
    | "defaultChecked"
    | "onCheckedChange"
    | "onBlur"
    | "aria-invalid"
  >;

export function FormCheckbox({ ...props }: FormCheckboxProps) {
  const field = useFieldContext<boolean>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <FormBase {...props} horizontal controlFirst>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.state.value}
        onBlur={field.handleBlur}
        onCheckedChange={(e) => field.handleChange(e === true)}
        aria-invalid={isInvalid}
        {...props}
      />
    </FormBase>
  );
}
