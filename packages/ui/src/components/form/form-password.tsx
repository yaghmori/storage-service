import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Eye, EyeOff } from "lucide-react";
import { FormBase, type FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

type FormPasswordProps = FormControlProps &
  Omit<
    React.ComponentProps<typeof Input>,
    | "id"
    | "name"
    | "value"
    | "defaultValue"
    | "onBlur"
    | "onChange"
    | "aria-invalid"
    | "type"
  >;

export function FormPassword({ children, ...props }: FormPasswordProps) {
  const field = useFieldContext<string>();
  const [showPassword, setShowPassword] = useState(false);
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <FormBase {...props}>
      <div className="relative flex items-center gap-2">
        <Input
          id={field.name}
          name={field.name}
          type={showPassword ? "text" : "password"}
          // Ensure we never pass `null` to the underlying input to avoid React warnings
          value={field.state.value ?? ""}
          onBlur={field.handleBlur}
          onChange={(e) => {
            const next = e.target.value;
            field.handleChange(next);
            // Show strength/requirement errors while typing, not only on blur
            if (!field.state.meta.isTouched) {
              field.setMeta((prev) => ({ ...prev, isTouched: true }));
            }
          }}
          aria-invalid={isInvalid}
          className={
            isInvalid
              ? "pr-10 border-destructive text-destructive bg-[#FDF2F2]"
              : "pr-10"
          }
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          {showPassword ? (
            <Eye className="text-muted-foreground h-4 w-4" />
          ) : (
            <EyeOff className="text-muted-foreground h-4 w-4" />
          )}
        </Button>
        {children}
      </div>
    </FormBase>
  );
}
