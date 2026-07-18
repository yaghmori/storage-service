"use client";

import { useSignIn } from "@/features/auth/hooks/use-auth-mutation";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { cn } from "@/lib/utils";
import { useAppForm } from "@workspace/ui/components";
import { Button } from "@workspace/ui/components/button";
import { loginSchema, type LoginInput } from "@workspace/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function LoginForm({
  className,
  returnUrl,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { returnUrl?: string }) {
  const { mutate: signIn, isPending } = useSignIn();
  const router = useRouter();
  const urlSearchParams = useSearchParams();

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: loginSchema },
    onSubmit: async ({ value }: { value: LoginInput }) => {
      signIn(value, {
        onSuccess: () => {
          toast.success("Welcome back!");
          const target =
            returnUrl ||
            urlSearchParams.get("returnUrl") ||
            "/";
          router.replace(target);
        },
        onError: (error: unknown) => {
          toast.error(extractApiErrorMessage(error, "Login failed"));
        },
      });
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">Storage Admin</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your admin credentials
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
        <form.AppField name="password">
          {(field) => (
            <field.Password label="Password" placeholder="Enter password" />
          )}
        </form.AppField>
        <div className="flex justify-end">
          <Link
            href={PAGE_ROUTES.AUTH.FORGOT_PASSWORD}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
        >
          {([canSubmit, isSubmitting, isValidating]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !canSubmit || isSubmitting || isValidating}
            >
              {isPending || isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
