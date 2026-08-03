import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field";
import { ReactNode } from "react";
import { useFieldContext } from "./useForm";

export type FormControlProps = {
  label?: ReactNode;
  description?: string;
  horizontal?: boolean;
  controlFirst?: boolean;
  showError?: boolean;
};

type FormBaseProps = FormControlProps & {
  children: ReactNode;
};

export function FormBase({
  children,
  label,
  description,
  controlFirst,
  horizontal,
  showError = true,
  ...props
}: FormBaseProps) {
  const field = useFieldContext();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const normalizedErrors = (field.state.meta.errors ?? []).map((error) =>
    typeof error === "string" ? { message: error } : error
  );
  const labelElement = (
    <>{label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}</>
  );
  const errorElem = isInvalid && (
    <FieldError errors={normalizedErrors} />
  );

  return (
    <Field
      data-invalid={isInvalid ? true : undefined}
      orientation={horizontal ? "horizontal" : undefined}
    >
      {controlFirst ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {children}
            <FieldContent>{labelElement}</FieldContent>

            {description && <FieldDescription>{description}</FieldDescription>}
          </div>
          {errorElem}
        </div>
      ) : (
        <>
          {labelElement ?? <FieldContent>{labelElement}</FieldContent>}
          {children}
          {showError ? errorElem : null}
          {description && <FieldDescription>{description}</FieldDescription>}
        </>
      )}
    </Field>
  );
}
