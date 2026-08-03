"use client";

import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import {
  createAdminUserSchema,
  updateAdminUserSchema,
  zodFlatFields,
} from "@workspace/validation";
import type { AdminUserRow } from "../hooks/use-users-queries";

type UserFormValues = {
  email: string;
  password: string;
  role: "admin" | "viewer";
  isActive: boolean;
};

export function AdminUserForm({
  formId = "admin-user-form",
  mode,
  initialValues,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  formId?: string;
  mode: "create" | "edit";
  initialValues?: Partial<AdminUserRow>;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: {
    email: string;
    password?: string;
    role: string;
    isActive?: boolean;
  }) => void;
  onCancel?: () => void;
}) {
  const validate = ({ value }: { value: UserFormValues }) => {
    const schema =
      mode === "create" ? createAdminUserSchema : updateAdminUserSchema;
    const result = schema.safeParse(value);
    if (!result.success) return zodFlatFields(result.error);
    return undefined;
  };

  const form = useAppForm({
    defaultValues: {
      email: initialValues?.email ?? "",
      password: "",
      role: (initialValues?.role as "admin" | "viewer") ?? "admin",
      isActive: initialValues?.isActive ?? true,
    } satisfies UserFormValues,
    validators: {
      onChange: validate,
      onSubmit: validate,
    },
    onSubmit: async ({ value }) => {
      onSubmit({
        email: value.email.trim(),
        password: value.password?.trim() || undefined,
        role: value.role,
        ...(mode === "edit" ? { isActive: value.isActive } : {}),
      });
    },
  });

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ResponsiveSheet.Content className="space-y-4 px-4 pb-4">
        <form.AppField name="email">
          {(field) => (
            <field.Input
              label="Email *"
              type="email"
              placeholder="admin@example.com"
              autoComplete="username"
              description="Sign-in email for the admin console."
            />
          )}
        </form.AppField>

        <form.AppField name="password">
          {(field) => (
            <field.Password
              label={
                mode === "create" ? "Password *" : "New password (optional)"
              }
              autoComplete="new-password"
              description={
                mode === "create"
                  ? "At least 8 characters with upper, lower, number, and special character."
                  : "Leave blank to keep the current password."
              }
            />
          )}
        </form.AppField>

        <form.AppField name="role">
          {(field) => (
            <field.Select
              label="Role *"
              options={[
                { label: "Admin", value: "admin" },
                { label: "Viewer", value: "viewer" },
              ]}
              description="Admins can manage orgs and users; viewers are read-only."
            />
          )}
        </form.AppField>

        {mode === "edit" && (
          <div className="rounded-md border bg-muted/30 p-3">
            <form.AppField name="isActive">
              {(field) => (
                <field.Checkbox label="Active — can sign in to the admin console" />
              )}
            </form.AppField>
          </div>
        )}
      </ResponsiveSheet.Content>

      <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
        >
          {([canSubmit, isFormSubmitting, isValidating]) => (
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !canSubmit ||
                isFormSubmitting ||
                isValidating
              }
            >
              {isSubmitting || isFormSubmitting ? "Saving…" : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveSheet.Footer>
    </form>
  );
}
