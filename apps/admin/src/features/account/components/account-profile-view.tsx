"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useAuth } from "@/provider/auth-provider";
import {
  AvatarUploader,
  Badge,
  Button,
  Card,
  CardContent,
  DateDisplay,
  Input,
  Label,
  useAppForm,
} from "@workspace/ui/components";
import { changePasswordSchema } from "@workspace/validation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAccountMeQuery,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} from "../hooks/use-account-queries";
import { AccountSettingsShell } from "./account-settings-shell";
import { SettingsHeading } from "./settings-heading";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AccountProfileView() {
  const { user, refreshSession } = useAuth();
  const { data: me, isLoading } = useAccountMeQuery();
  const updateProfile = useUpdateProfileMutation();
  const changePassword = useChangePasswordMutation();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFiles, setAvatarFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.name ?? "");
    setAvatarUrl(me.avatar);
    setAvatarFiles([]);
  }, [me]);

  const passwordForm = useAppForm({
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
            passwordForm.reset();
          },
          onError: (err) =>
            toast.error(extractApiErrorMessage(err, "Password update failed")),
        },
      );
    },
  });

  const saveProfile = async () => {
    let nextAvatar = avatarUrl;
    const file = avatarFiles[0];
    if (file) {
      nextAvatar = await fileToDataUrl(file);
    }

    updateProfile.mutate(
      {
        name: displayName.trim() || null,
        avatar: nextAvatar,
      },
      {
        onSuccess: async () => {
          toast.success("Profile updated");
          setAvatarFiles([]);
          await refreshSession();
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Profile update failed")),
      },
    );
  };

  const email = me?.email ?? user?.email ?? "—";
  const role = me?.role ?? user?.role ?? "—";
  const initials =
    (displayName || email)
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <AccountSettingsShell
      title="Profile"
      description="Your admin account identity and security."
    >
      <div className="flex flex-col gap-5">
        <SettingsHeading
          title="Account"
          description="Signed-in administrator details for this console."
        />

        <Card>
          <CardContent className="space-y-6 p-6">
            {isLoading && !me ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <AvatarUploader
                    size="md"
                    currentImageUrl={avatarUrl ?? undefined}
                    fallbackText={initials}
                    value={avatarFiles}
                    onValueChange={setAvatarFiles}
                  />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Display name</Label>
                      <Input
                        id="profile-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        maxLength={255}
                      />
                    </div>
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
                            variant={
                              me?.isActive !== false ? "default" : "secondary"
                            }
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
                    <Button
                      type="button"
                      onClick={() => void saveProfile()}
                      disabled={updateProfile.isPending}
                    >
                      {updateProfile.isPending ? "Saving…" : "Save profile"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <SettingsHeading
          title="Change password"
          description="Update the password used to sign in to this admin console."
        />

        <Card>
          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                passwordForm.handleSubmit();
              }}
              className="max-w-md space-y-4"
            >
              <passwordForm.AppField name="currentPassword">
                {(field) => (
                  <field.Password
                    label="Current password"
                    autoComplete="current-password"
                  />
                )}
              </passwordForm.AppField>
              <passwordForm.AppField name="newPassword">
                {(field) => (
                  <field.Password
                    label="New password"
                    autoComplete="new-password"
                  />
                )}
              </passwordForm.AppField>
              <passwordForm.AppField name="confirmPassword">
                {(field) => (
                  <field.Password
                    label="Confirm new password"
                    autoComplete="new-password"
                  />
                )}
              </passwordForm.AppField>
              <passwordForm.Subscribe
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
              </passwordForm.Subscribe>
            </form>
          </CardContent>
        </Card>
      </div>
    </AccountSettingsShell>
  );
}
