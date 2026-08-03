import { FileUploader } from "../custom";
import { FormBase, type FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormImageUploaderProps = FormControlProps & {
  align?: "center" | "left" | "right";
  size?: number;
  previewClassName?: string;
  inputClassName?: string;
  displayPreview?: boolean;
};

export function FormImageUploader({
  align = "center",
  size = 3 * 1024 * 1024, // 3MB
  previewClassName,
  inputClassName,
  displayPreview = true,
  ...props
}: FormImageUploaderProps) {
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
        disabled={false}
        align={align}
        size={size}
        previewClassName={previewClassName}
        inputClassName={inputClassName}
        displayPreview={displayPreview}
      />
    </FormBase>
  );
}
