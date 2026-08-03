import type { ComponentProps } from "react";

import { FileUploader } from "../custom";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormFileUploaderProps = FormControlProps &
  Omit<
    ComponentProps<typeof FileUploader>,
    "value" | "onChange" | "onBlur" | "disabled"
  > & {
    disabled?: boolean;
  };

export function FormFileUploader({
  align = "center",
  size,
  previewClassName,
  inputClassName,
  displayPreview = true,
  disabled,
  ...props
}: FormFileUploaderProps) {
  const field = useFieldContext<File | null | undefined>();

  return (
    <FormBase {...props}>
      <FileUploader
        value={field.state.value ?? null}
        onChange={(file) => {
          field.handleChange(file);
          field.handleBlur();
        }}
        onBlur={field.handleBlur}
        disabled={disabled ?? false}
        align={align}
        size={size}
        previewClassName={previewClassName}
        inputClassName={inputClassName}
        displayPreview={displayPreview}
        {...props}
      />
    </FormBase>
  );
}
