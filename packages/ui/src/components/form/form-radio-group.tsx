import type { ComponentProps, ReactNode } from "react";

import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";

import { FormBase, type FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormRadioGroupOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
};

type FormRadioGroupRenderContext = {
  input: ReactNode;
  isSelected: boolean;
  isDisabled: boolean;
  option: FormRadioGroupOption;
  index: number;
};

type FormRadioGroupProps = FormControlProps &
  Omit<ComponentProps<typeof RadioGroup>, "defaultValue" | "value"> & {
    options?: ReadonlyArray<FormRadioGroupOption>;
    itemClassName?: string;
    disabled?: boolean;
    renderOption?: (context: FormRadioGroupRenderContext) => ReactNode;
    children?: ReactNode;
  };

export function FormRadioGroup({
  options,
  itemClassName,
  renderOption,
  className,
  disabled,
  children,
  showError = true,
  controlFirst,
  horizontal,
  label,
  description,
  onValueChange,
  ...radioGroupProps
}: FormRadioGroupProps) {
  const field = useFieldContext<string>();
  const isInvalid =
    field.state.meta.isTouched && field.state.meta.isValid === false;
  const currentValue = field.state.value ?? "";

  const handleChange = (nextValue: string) => {
    field.handleChange(nextValue);
    /**
     * Radio groups do not emit blur events in the same way as traditional inputs.
     * Trigger a blur manually to ensure touched state updates for validation feedback.
     */
    field.handleBlur();
    onValueChange?.(nextValue);
  };

  const renderDefaultOption = (
    option: FormRadioGroupOption,
    index: number,
    isOptionDisabled: boolean
  ) => {
    const id = option.id ?? `${field.name}-${option.value}`;

    return (
      <label
        key={option.value}
        htmlFor={id}
        className={cn(
          "flex items-center gap-2 text-sm",
          option.description ? "flex-col items-start gap-1.5" : undefined,
          itemClassName,
          option.className
        )}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem
            id={id}
            value={option.value}
            disabled={isOptionDisabled}
            aria-invalid={isInvalid}
          />
          <span className="leading-tight font-medium">{option.label}</span>
        </div>
        {option.description ? (
          <span className="text-muted-foreground text-xs leading-snug">
            {option.description}
          </span>
        ) : null}
      </label>
    );
  };

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
        className={cn("mt-3 flex flex-col gap-3", className)}
        {...radioGroupProps}
      >
        {options?.map((option, index) => {
          const id = option.id ?? `${field.name}-${option.value}`;
          const isOptionDisabled = option.disabled ?? disabled ?? false;

          if (renderOption) {
            const radioItem = (
              <RadioGroupItem
                id={id}
                value={option.value}
                disabled={isOptionDisabled}
                aria-invalid={isInvalid}
              />
            );

            return (
              <div key={option.value} className="contents">
                {renderOption({
                  input: radioItem,
                  isSelected: currentValue === option.value,
                  isDisabled: isOptionDisabled,
                  option,
                  index,
                })}
              </div>
            );
          }

          return renderDefaultOption(option, index, isOptionDisabled);
        })}
        {children}
      </RadioGroup>
    </FormBase>
  );
}
