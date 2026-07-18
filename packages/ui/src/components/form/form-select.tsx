import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { ReactNode } from "react";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

export interface SelectOption {
  value: number | string;
  label: string;
}

type FormSelectProps = FormControlProps & {
  /** Pass either children (SelectItem components) or options array */
  children?: ReactNode;
  /** Options array - alternative to children */
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function FormSelect({
  children,
  options,
  placeholder,
  disabled,
  ...props
}: FormSelectProps) {
  const field = useFieldContext<string | number | null>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  // Always controlled: use null (not undefined) when empty so Base UI
  // does not flip from uncontrolled → controlled after the first selection.
  const stringValue =
    field.state.value != null && field.state.value !== ""
      ? String(field.state.value)
      : null;

  // Handle value change - convert back to number if options use numbers
  const handleValueChange = (newValue: string) => {
    if (options && options.length > 0) {
      const option = options.find((opt) => String(opt.value) === newValue);
      if (option) {
        field.handleChange(option.value);
        return;
      }
    }
    field.handleChange(newValue);
  };

  // Base UI shows raw value unless `items` maps value → label.
  const items = options?.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  return (
    <FormBase {...props}>
      <Select
        onValueChange={handleValueChange}
        value={stringValue}
        disabled={disabled}
        items={items}
      >
        <SelectTrigger
          aria-invalid={isInvalid}
          id={field.name}
          onBlur={field.handleBlur}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options
            ? options.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))
            : children}
        </SelectContent>
      </Select>
    </FormBase>
  );
}
