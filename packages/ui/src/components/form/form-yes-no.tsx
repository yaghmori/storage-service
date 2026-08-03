import type { ComponentProps } from "react";

import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";

import { FormBase, type FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormYesNoProps = FormControlProps &
  Omit<ComponentProps<typeof RadioGroup>, "defaultValue" | "value" | "onValueChange"> & {
    yesLabel?: string;
    noLabel?: string;
    disabled?: boolean;
  };

/**
 * A Yes/No radio group for boolean fields that require explicit user selection.
 *
 * Unlike checkboxes which default to false, this component:
 * - Starts with no selection (null)
 * - Requires user to explicitly choose Yes or No
 * - Returns true for Yes, false for No
 *
 * Use this for required boolean questions where you need to ensure
 * the user actively made a choice.
 */
export function FormYesNo({
  yesLabel = "Yes",
  noLabel = "No",
  disabled,
  className,
  showError = true,
  controlFirst,
  horizontal,
  label,
  description,
  ...radioGroupProps
}: FormYesNoProps) {
  const field = useFieldContext<boolean | null>();
  const isInvalid =
    field.state.meta.isTouched && field.state.meta.isValid === false;

  // Convert boolean | null to string for RadioGroup
  const currentValue =
    field.state.value === true
      ? "yes"
      : field.state.value === false
        ? "no"
        : "";

  const handleChange = (nextValue: string) => {
    const boolValue = nextValue === "yes" ? true : nextValue === "no" ? false : null;
    field.handleChange(boolValue);
    field.handleBlur();
  };

  const yesId = `${field.name}-yes`;
  const noId = `${field.name}-no`;

  return (
    <FormBase
      label={label}
      description={description}
      controlFirst={controlFirst}
      horizontal={horizontal}
      showError={showError}
    >
      <RadioGroup
        value={currentValue}
        onValueChange={handleChange}
        className={cn("mt-2 flex gap-4", className)}
        disabled={disabled}
        {...radioGroupProps}
      >
        <label
          htmlFor={yesId}
          className={cn(
            "flex items-center gap-2 text-sm cursor-pointer",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <RadioGroupItem
            id={yesId}
            value="yes"
            disabled={disabled}
            aria-invalid={isInvalid}
          />
          <span className="leading-tight font-medium">{yesLabel}</span>
        </label>

        <label
          htmlFor={noId}
          className={cn(
            "flex items-center gap-2 text-sm cursor-pointer",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <RadioGroupItem
            id={noId}
            value="no"
            disabled={disabled}
            aria-invalid={isInvalid}
          />
          <span className="leading-tight font-medium">{noLabel}</span>
        </label>
      </RadioGroup>
    </FormBase>
  );
}
