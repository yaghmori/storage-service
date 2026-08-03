import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Icons } from "@workspace/ui/config/icons";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  showPasswordToggle?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showPasswordToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn(
            showPasswordToggle && "pr-10", // Add right padding for the toggle button
            className
          )}
          ref={ref}
          {...props}
        />
        {showPasswordToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
          >
            {showPassword ? (
              <Icons.eyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Icons.eye className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </Button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
