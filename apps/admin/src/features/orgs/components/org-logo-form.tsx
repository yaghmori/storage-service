"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { IMAGES } from "@/lib/constants/images";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateOrganizationMutation } from "../hooks/use-orgs-queries";
import {
  OrgMaskedAvatar,
  resolveOrgAvatarSrc,
} from "./org-masked-avatar";
import { ProfileMaskedOverlay } from "@/features/account/components/profile-masked-avatar";

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function OrgLogoForm({
  orgId,
  orgName,
  logoUrl,
}: {
  orgId: string;
  orgName: string;
  logoUrl?: string | null;
}) {
  const updateMutation = useUpdateOrganizationMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    setPreviewUrl(null);
    setPendingFile(null);
    setRemoveLogo(false);
  }, [orgId, logoUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentImageSrc = removeLogo
    ? IMAGES.orgPlaceholder
    : resolveOrgAvatarSrc(previewUrl || logoUrl);
  const hasCustomImage = Boolean(
    !removeLogo &&
      resolveOrgAvatarSrc(previewUrl || logoUrl) !== IMAGES.orgPlaceholder,
  );
  const isBusy = updateMutation.isPending;
  const canSave = Boolean(pendingFile) || removeLogo;

  const pickFile = (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error("Use a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be 3 MB or smaller");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const clearLogo = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setRemoveLogo(true);
  };

  const saveLogo = async () => {
    let nextLogo: string | null = logoUrl ?? null;
    if (removeLogo) {
      nextLogo = null;
    } else if (pendingFile) {
      nextLogo = await fileToDataUrl(pendingFile);
    }

    updateMutation.mutate(
      { id: orgId, input: { logoUrl: nextLogo } },
      {
        onSuccess: () => {
          toast.success("Organization logo updated");
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setPendingFile(null);
          setRemoveLogo(false);
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Logo update failed")),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Organization logo</CardTitle>
        <CardDescription>
          Shown in the organization switcher. If unset, the shared placeholder
          is used.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          className="group relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          aria-label="Set organization logo"
        >
          <OrgMaskedAvatar
            src={currentImageSrc}
            alt={orgName}
            sizeClassName="size-24 sm:size-28"
          />
          <ProfileMaskedOverlay>
            {isBusy ? (
              <span className="size-6 animate-pulse rounded-full bg-background/70" />
            ) : (
              <Camera className="size-7 text-background drop-shadow-sm" />
            )}
          </ProfileMaskedOverlay>
        </button>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickFile(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <ImagePlus className="size-4" />
              Set logo
            </Button>
            {hasCustomImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={clearLogo}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Remove logo
              </Button>
            ) : null}
            {canSave ? (
              <Button
                type="button"
                size="sm"
                disabled={isBusy}
                onClick={() => void saveLogo()}
              >
                {isBusy ? "Saving…" : "Save logo"}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WebP up to 3 MB.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
