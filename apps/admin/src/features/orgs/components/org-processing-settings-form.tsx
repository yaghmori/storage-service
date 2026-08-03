"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Switch,
} from "@workspace/ui/components";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type OrgProcessingSettings,
  useOrgProcessingSettingsQuery,
  useUpdateOrgProcessingSettingsMutation,
} from "../hooks/use-orgs-queries";

type FormState = {
  enableImageProcessing: boolean;
  enableVideoProcessing: boolean;
  enableMetadataExtraction: boolean;
  thumbnailEnabled: boolean;
  thumbnailMaxEdge: number;
  mediumEnabled: boolean;
  mediumMaxEdge: number;
  formatWebp: boolean;
  formatAvif: boolean;
  videoThumbnail: boolean;
  videoPreviewFrames: number;
};

function toForm(settings: OrgProcessingSettings): FormState {
  const variants = settings.imageVariants ?? {
    thumbnail: {
      enabled: true,
      maxEdge: settings.imageSizes?.[0] ?? 200,
    },
    medium: {
      enabled: (settings.imageSizes?.length ?? 0) > 1,
      maxEdge: settings.imageSizes?.[1] ?? 800,
    },
  };
  const formats = settings.imageFormats ?? ["webp"];
  return {
    enableImageProcessing: settings.enableImageProcessing,
    enableVideoProcessing: settings.enableVideoProcessing,
    enableMetadataExtraction: settings.enableMetadataExtraction,
    thumbnailEnabled: variants.thumbnail.enabled,
    thumbnailMaxEdge: variants.thumbnail.maxEdge,
    mediumEnabled: variants.medium.enabled,
    mediumMaxEdge: variants.medium.maxEdge,
    formatWebp: formats.includes("webp"),
    formatAvif: formats.includes("avif"),
    videoThumbnail: settings.videoThumbnail,
    videoPreviewFrames: settings.videoPreviewFrames,
  };
}

export function OrgProcessingSettingsForm({ orgId }: { orgId: string }) {
  const query = useOrgProcessingSettingsQuery(orgId);
  const updateMutation = useUpdateOrgProcessingSettingsMutation(orgId);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  if (query.isLoading || !form) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading processing settings…
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
        Failed to load processing settings
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <ToggleRow
          label="Image processing"
          description="Generate thumbnail / medium variants on upload"
          checked={form.enableImageProcessing}
          onCheckedChange={(checked) =>
            setForm((f) => (f ? { ...f, enableImageProcessing: checked } : f))
          }
        />
        <ToggleRow
          label="Video processing"
          description="Generate video thumbnail and preview frames"
          checked={form.enableVideoProcessing}
          onCheckedChange={(checked) =>
            setForm((f) => (f ? { ...f, enableVideoProcessing: checked } : f))
          }
        />
        <ToggleRow
          label="Metadata extraction"
          description="Extract EXIF / IPTC sidecar metadata"
          checked={form.enableMetadataExtraction}
          onCheckedChange={(checked) =>
            setForm((f) =>
              f ? { ...f, enableMetadataExtraction: checked } : f,
            )
          }
        />
        <ToggleRow
          label="Video thumbnail"
          description="First-frame thumbnail when video processing runs"
          checked={form.videoThumbnail}
          onCheckedChange={(checked) =>
            setForm((f) => (f ? { ...f, videoThumbnail: checked } : f))
          }
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Image variants</h3>
          <p className="text-xs text-muted-foreground">
            Apps request these by name (`variant=thumbnail` or `medium`). Pixel
            size is the max width; height follows the original aspect ratio (no
            square crop, no upscale).
          </p>
        </div>

        <VariantSlotRow
          label="Thumbnail"
          description="Lists, avatars, and compact previews"
          enabled={form.thumbnailEnabled}
          maxEdge={form.thumbnailMaxEdge}
          onEnabledChange={(checked) =>
            setForm((f) => (f ? { ...f, thumbnailEnabled: checked } : f))
          }
          onMaxEdgeChange={(maxEdge) =>
            setForm((f) => (f ? { ...f, thumbnailMaxEdge: maxEdge } : f))
          }
          disabled={!form.enableImageProcessing}
        />
        <VariantSlotRow
          label="Medium"
          description="Larger previews and detail views"
          enabled={form.mediumEnabled}
          maxEdge={form.mediumMaxEdge}
          onEnabledChange={(checked) =>
            setForm((f) => (f ? { ...f, mediumEnabled: checked } : f))
          }
          onMaxEdgeChange={(maxEdge) =>
            setForm((f) => (f ? { ...f, mediumMaxEdge: maxEdge } : f))
          }
          disabled={!form.enableImageProcessing}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Output formats</Label>
          <div className="flex flex-wrap gap-4 rounded-lg border px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.formatWebp}
                onCheckedChange={(checked) =>
                  setForm((f) =>
                    f ? { ...f, formatWebp: checked === true } : f,
                  )
                }
                disabled={!form.enableImageProcessing}
              />
              WebP
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.formatAvif}
                onCheckedChange={(checked) =>
                  setForm((f) =>
                    f ? { ...f, formatAvif: checked === true } : f,
                  )
                }
                disabled={!form.enableImageProcessing}
              />
              AVIF
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preview-frames">Video preview frames</Label>
          <Input
            id="preview-frames"
            type="number"
            min={0}
            max={30}
            value={form.videoPreviewFrames}
            onChange={(e) =>
              setForm((f) =>
                f
                  ? {
                      ...f,
                      videoPreviewFrames: Number(e.target.value) || 0,
                    }
                  : f,
              )
            }
            disabled={!form.enableVideoProcessing}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={updateMutation.isPending}
          onClick={() => {
            if (
              form.enableImageProcessing &&
              !form.thumbnailEnabled &&
              !form.mediumEnabled
            ) {
              toast.error("Enable at least one image variant (thumbnail or medium)");
              return;
            }
            const thumb = Math.floor(Number(form.thumbnailMaxEdge));
            const med = Math.floor(Number(form.mediumMaxEdge));
            if (
              !Number.isFinite(thumb) ||
              thumb < 1 ||
              thumb > 4096 ||
              !Number.isFinite(med) ||
              med < 1 ||
              med > 4096
            ) {
              toast.error("Max edge must be between 1 and 4096");
              return;
            }
            if (
              form.thumbnailEnabled &&
              form.mediumEnabled &&
              thumb > med
            ) {
              toast.error("Thumbnail max edge must be ≤ medium max edge");
              return;
            }
            const formats: Array<"webp" | "avif"> = [];
            if (form.formatWebp) formats.push("webp");
            if (form.formatAvif) formats.push("avif");
            if (form.enableImageProcessing && formats.length === 0) {
              toast.error("Select at least one output format");
              return;
            }

            updateMutation.mutate(
              {
                enableImageProcessing: form.enableImageProcessing,
                enableVideoProcessing: form.enableVideoProcessing,
                enableMetadataExtraction: form.enableMetadataExtraction,
                imageVariants: {
                  thumbnail: {
                    enabled: form.thumbnailEnabled,
                    maxEdge: thumb,
                  },
                  medium: {
                    enabled: form.mediumEnabled,
                    maxEdge: med,
                  },
                },
                imageFormats: formats.length > 0 ? formats : ["webp"],
                videoThumbnail: form.videoThumbnail,
                videoPreviewFrames: form.videoPreviewFrames,
              },
              {
                onSuccess: () => toast.success("Processing settings saved"),
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Save failed")),
              },
            );
          }}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save processing settings"
          )}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function VariantSlotRow({
  label,
  description,
  enabled,
  maxEdge,
  onEnabledChange,
  onMaxEdgeChange,
  disabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
  maxEdge: number;
  onEnabledChange: (checked: boolean) => void;
  onMaxEdgeChange: (maxEdge: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:w-40">
        <Input
          type="number"
          min={1}
          max={4096}
          value={maxEdge}
          disabled={disabled || !enabled}
          onChange={(e) => onMaxEdgeChange(Number(e.target.value) || 0)}
          aria-label={`${label} max width`}
        />
        <span className="shrink-0 text-xs text-muted-foreground">px</span>
      </div>
    </div>
  );
}
