"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useAuth } from "@/provider/auth-provider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DateDisplay,
  useAppForm,
} from "@workspace/ui/components";
import { changePasswordSchema } from "@workspace/validation";
import { toast } from "sonner";
import {
  useAccountMeQuery,
  useChangePasswordMutation,
} from "../hooks/use-account-queries";
import { AccountSettingsShell } from "./account-settings-shell";

export function AccountProfileView() {
  const { user } = useAuth();
  const { data: me, isLoading } = useAccountMeQuery();
  const changePassword = useChangePasswordMutation();

  const form = useAppForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: { onChange: changePasswordSchema },
    onSubmit: async ({ value }) => {
      changePassword.mutate(
        {
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        },
        {
          onSuccess: () => {
            toast.success("Password updated");
            form.reset();
          },
          onError: (err) =>
            toast.error(extractApiErrorMessage(err, "Password update failed")),
        },
      );
    },
  });

  const email = me?.email ?? user?.email ?? "—";
  const role = me?.role ?? user?.role ?? "—";

  return (
    <AccountSettingsShell
      title="Profile"
      description="Your admin account identity and security."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed-in administrator details.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !me ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>
                    <Badge variant="secondary">{role}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge
                      variant={me?.isActive !== false ? "default" : "secondary"}
                    >
                      {me?.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last login</dt>
                  <dd>
                    {me?.lastLoginAt ? (
                      <DateDisplay date={me.lastLoginAt} />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>
                    {me?.createdAt ? (
                      <DateDisplay date={me.createdAt} />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Update the password used to sign in to this admin console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="max-w-md space-y-4"
            >
              <form.AppField name="currentPassword">
                {(field) => (
                  <field.Password label="Current password" autoComplete="current-password" />
                )}
              </form.AppField>
              <form.AppField name="newPassword">
                {(field) => (
                  <field.Password label="New password" autoComplete="new-password" />
                )}
              </form.AppField>
              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.Password
                    label="Confirm new password"
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>
              <form.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
              >
                {([canSubmit, isSubmitting, isValidating]) => (
                  <Button
                    type="submit"
                    disabled={
                      changePassword.isPending ||
                      !canSubmit ||
                      isSubmitting ||
                      isValidating
                    }
                  >
                    {changePassword.isPending || isSubmitting
                      ? "Updating…"
                      : "Update password"}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>
      </div>
    </AccountSettingsShell>
  );
}
