"use client";

import { useForgotPassword } from "@/features/auth/hooks/use-auth-mutation";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { cn } from "@/lib/utils";
import { useAppForm } from "@workspace/ui/components";
import { Button } from "@workspace/ui/components/button";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@workspace/validation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { mutate: forgotPassword, isPending } = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onChange: forgotPasswordSchema },
    onSubmit: async ({ value }: { value: ForgotPasswordInput }) => {
      forgotPassword(value, {
        onSuccess: (result) => {
          setSubmitted(true);
          toast.success(
            result.message ||
              "Temporary password written to container logs. Check docker logs.",
          );
        },
        onError: (error: unknown) => {
          toast.error(extractApiErrorMessage(error, "Request failed"));
        },
      });
    },
  });

  if (submitted) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold">Check container logs</h1>
          <p className="text-sm text-muted-foreground">
            A temporary password was written to the storage-service container
            logs. Sign in with it, then change your password from account
            settings.
          </p>
        </div>
        <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-left text-xs text-muted-foreground">
          {`docker logs <storage-service-container> 2>&1 | grep "ADMIN PASSWORD RESET"`}
        </pre>
        <Button asChild variant="outline" className="w-full">
          <Link href={PAGE_ROUTES.AUTH.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your admin email. A temporary password will be printed to the
          service container logs.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid gap-4"
      >
        <form.AppField name="email">
          {(field) => (
            <field.Input
              label="Email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="email"
            />
          )}
        </form.AppField>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
        >
          {([canSubmit, isSubmitting, isValidating]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !canSubmit || isSubmitting || isValidating}
            >
              {isPending || isSubmitting
                ? "Resetting..."
                : "Reset password"}
            </Button>
          )}
        </form.Subscribe>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={PAGE_ROUTES.AUTH.LOGIN}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
