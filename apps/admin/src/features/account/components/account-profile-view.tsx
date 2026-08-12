"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { IMAGES } from "@/lib/constants/images";
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
  Input,
  Label,
  Skeleton,
  useAppForm,
} from "@workspace/ui/components";
import { changePasswordSchema } from "@workspace/validation";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAccountMeQuery,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} from "../hooks/use-account-queries";
import { AccountSettingsShell } from "./account-settings-shell";
import {
  ProfileMaskedAvatar,
  ProfileMaskedOverlay,
  resolveProfileAvatarSrc,
} from "./profile-masked-avatar";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.name ?? "");
    setAvatarUrl(me.avatar);
    setAvatarPreview(null);
    setAvatarFile(null);
    setRemoveAvatar(false);
  }, [me]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

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

  const email = me?.email ?? user?.email ?? "—";
  const role = me?.role ?? user?.role ?? "—";
  const shownName = displayName.trim() || email;
  const currentImageSrc = removeAvatar
    ? IMAGES.defaultAvatar
    : resolveProfileAvatarSrc(avatarPreview || avatarUrl);
  const hasCustomImage = Boolean(
    !removeAvatar && resolveProfileAvatarSrc(avatarPreview || avatarUrl) !== IMAGES.defaultAvatar,
  );
  const isAvatarBusy = updateProfile.isPending;

  const pickAvatarFile = (file: File) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const clearAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  };

  const saveProfile = async () => {
    let nextAvatar: string | null = avatarUrl;
    if (removeAvatar) {
      nextAvatar = null;
    } else if (avatarFile) {
      nextAvatar = await fileToDataUrl(avatarFile);
    }

    updateProfile.mutate(
      {
        name: displayName.trim() || null,
        avatar: nextAvatar,
      },
      {
        onSuccess: async () => {
          toast.success("Profile updated");
          setAvatarFile(null);
          if (avatarPreview) URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
          setRemoveAvatar(false);
          await refreshSession();
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Profile update failed")),
      },
    );
  };

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

        {isLoading && !me ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-28 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-8 w-36" />
              </div>
            </div>
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-center sm:gap-5">
                <button
                  type="button"
                  className="group relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAvatarBusy}
                  aria-label="Set photo"
                >
                  <ProfileMaskedAvatar
                    src={currentImageSrc}
                    alt={shownName}
                    sizeClassName="size-28 sm:size-32"
                  />
                  <ProfileMaskedOverlay>
                    {isAvatarBusy ? (
                      <span className="size-6 animate-pulse rounded-full bg-background/70" />
                    ) : (
                      <Camera className="size-7 text-background drop-shadow-sm" />
                    )}
                  </ProfileMaskedOverlay>
                </button>

                <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                      {shownName}
                    </h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {email}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) pickAvatarFile(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isAvatarBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5"
                    >
                      <ImagePlus className="size-4" />
                      Set photo
                    </Button>
                    {hasCustomImage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isAvatarBusy}
                        onClick={clearAvatar}
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Personal information</CardTitle>
                <CardDescription>
                  Update how your name appears across the admin console.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
                </dl>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <SettingsHeading
          title="Change password"
          description="Update the password used to sign in to this admin console."
        />

        <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
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
