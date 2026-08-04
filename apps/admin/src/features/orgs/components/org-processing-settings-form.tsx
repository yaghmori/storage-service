"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { BackendModelPicker } from "@/features/processor-backends/components/backend-model-picker";
import { useProcessorBackendsQuery } from "@/features/processor-backends/hooks/use-processor-backends-queries";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import {
  ProcessorKey,
  ProcessorKeyDescriptions,
  ProcessorKeyLabels,
} from "@workspace/validation";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type OrgProcessingSettings,
  useOrgProcessingSettingsQuery,
  useUpdateOrgProcessingSettingsMutation,
} from "../hooks/use-orgs-queries";

/** Sentinel so the combobox stays controlled when no backend is chosen. */
const NONE_BACKEND_VALUE = "__none__";

type FormState = {
  enableImageProcessing: boolean;
  enableVideoProcessing: boolean;
  enableMetadataExtraction: boolean;
  enableAiProcessing: boolean;
  enableAiCaption: boolean;
  enableAiTags: boolean;
  enableAiNsfw: boolean;
  nsfwThreshold: number;
  aiBackendId: string;
  aiVisionModel: string;
  documentOcrBackendId: string;
  documentOcrVisionModel: string;
  thumbnailEnabled: boolean;
  thumbnailMaxEdge: number;
  mediumEnabled: boolean;
  mediumMaxEdge: number;
  formatWebp: boolean;
  formatAvif: boolean;
  videoThumbnail: boolean;
  videoPreviewFrames: number;
  enableImageNormalize: boolean;
  enableDedupePhash: boolean;
  phashThresholdBits: number;
  enableIntegrityVerify: boolean;
  enableVirusScan: boolean;
  virusScanBackendId: string;
  enableDocumentPreview: boolean;
  enableDocumentText: boolean;
  enableDocumentOcr: boolean;
  documentOcrEngine: "openai_compatible" | "tesseract";
  enableNotifyWebhook: boolean;
  notifyWebhookUrl: string;
  notifyWebhookSecret: string;
  processorCapacity: Record<
    string,
    { concurrency: number; rateMax: number | null; rateDurationMs: number | null }
  >;
};

type EnabledKey = keyof Pick<
  FormState,
  | "enableImageNormalize"
  | "enableImageProcessing"
  | "enableMetadataExtraction"
  | "enableVideoProcessing"
  | "enableDocumentPreview"
  | "enableDocumentText"
  | "enableDocumentOcr"
  | "enableIntegrityVerify"
  | "enableVirusScan"
  | "enableDedupePhash"
  | "enableAiProcessing"
  | "enableNotifyWebhook"
>;

type ProcessorDef = {
  key: string;
  enabledKey: EnabledKey;
  whenDisabled: string;
};

const PROCESSOR_GROUPS: Array<{
  id: string;
  label: string;
  description: string;
  processors: ProcessorDef[];
}> = [
  {
    id: "security",
    label: "Security",
    description: "Antivirus scanning via ClamAV before other processors.",
    processors: [
      {
        key: ProcessorKey.SECURITY_VIRUS_SCAN,
        enabledKey: "enableVirusScan",
        whenDisabled:
          "Uploaded files are not scanned; infected content is not quarantined.",
      },
    ],
  },
  {
    id: "images",
    label: "Images",
    description: "Normalize uploads, variants, and camera metadata.",
    processors: [
      {
        key: ProcessorKey.IMAGE_NORMALIZE,
        enabledKey: "enableImageNormalize",
        whenDisabled:
          "HEIC/GIF stay as uploaded; variants and AI may fail on those formats.",
      },
      {
        key: ProcessorKey.IMAGE_VARIANTS,
        enabledKey: "enableImageProcessing",
        whenDisabled: "No thumbnail/medium derivatives are generated on upload.",
      },
      {
        key: ProcessorKey.METADATA_EXIF,
        enabledKey: "enableMetadataExtraction",
        whenDisabled: "EXIF/IPTC/XMP are not stored on the file record.",
      },
    ],
  },
  {
    id: "video",
    label: "Video",
    description: "Poster frames and preview stills via ffmpeg.",
    processors: [
      {
        key: ProcessorKey.VIDEO_PREVIEW,
        enabledKey: "enableVideoProcessing",
        whenDisabled: "Videos are stored as-uploaded with no preview artifacts.",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    description: "PDF preview, native text, and OCR for scans.",
    processors: [
      {
        key: ProcessorKey.DOCUMENT_PREVIEW,
        enabledKey: "enableDocumentPreview",
        whenDisabled: "PDFs have no first-page thumbnail.",
      },
      {
        key: ProcessorKey.DOCUMENT_TEXT,
        enabledKey: "enableDocumentText",
        whenDisabled: "Native PDF/text content is not extracted.",
      },
      {
        key: ProcessorKey.DOCUMENT_OCR,
        enabledKey: "enableDocumentOcr",
        whenDisabled: "Scanned PDFs/images without native text stay empty.",
      },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    description: "Integrity checks and near-duplicate detection.",
    processors: [
      {
        key: ProcessorKey.INTEGRITY_VERIFY,
        enabledKey: "enableIntegrityVerify",
        whenDisabled:
          "Upload SHA-256 is trusted without a re-hash of stored object bytes.",
      },
      {
        key: ProcessorKey.DEDUPE_PHASH,
        enabledKey: "enableDedupePhash",
        whenDisabled: "No perceptual hash or near-duplicate flags are created.",
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    description: "Captions, tags, and NSFW scoring.",
    processors: [
      {
        key: ProcessorKey.AI_VISION,
        enabledKey: "enableAiProcessing",
        whenDisabled: "No caption, tags, or NSFW scores are generated.",
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Webhook when processing finishes.",
    processors: [
      {
        key: ProcessorKey.NOTIFY_WEBHOOK,
        enabledKey: "enableNotifyWebhook",
        whenDisabled: "No HTTP callback is sent when processing finishes.",
      },
    ],
  },
];

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
    enableAiProcessing: settings.enableAiProcessing,
    enableAiCaption: settings.enableAiCaption,
    enableAiTags: settings.enableAiTags,
    enableAiNsfw: settings.enableAiNsfw,
    nsfwThreshold: settings.nsfwThreshold,
    aiBackendId: settings.aiBackendId ?? NONE_BACKEND_VALUE,
    aiVisionModel: settings.aiVisionModel ?? "",
    documentOcrBackendId: settings.documentOcrBackendId ?? NONE_BACKEND_VALUE,
    documentOcrVisionModel: settings.documentOcrVisionModel ?? "",
    thumbnailEnabled: variants.thumbnail.enabled,
    thumbnailMaxEdge: variants.thumbnail.maxEdge,
    mediumEnabled: variants.medium.enabled,
    mediumMaxEdge: variants.medium.maxEdge,
    formatWebp: formats.includes("webp"),
    formatAvif: formats.includes("avif"),
    videoThumbnail: settings.videoThumbnail,
    videoPreviewFrames: settings.videoPreviewFrames,
    enableImageNormalize: settings.enableImageNormalize ?? true,
    enableDedupePhash: settings.enableDedupePhash ?? false,
    phashThresholdBits: settings.phashThresholdBits ?? 10,
    enableIntegrityVerify: settings.enableIntegrityVerify ?? false,
    enableVirusScan: settings.enableVirusScan ?? false,
    virusScanBackendId: settings.virusScanBackendId ?? NONE_BACKEND_VALUE,
    enableDocumentPreview: settings.enableDocumentPreview ?? true,
    enableDocumentText: settings.enableDocumentText ?? true,
    enableDocumentOcr: settings.enableDocumentOcr ?? false,
    documentOcrEngine:
      settings.documentOcrEngine === "tesseract"
        ? "tesseract"
        : "openai_compatible",
    enableNotifyWebhook: settings.enableNotifyWebhook ?? false,
    notifyWebhookUrl: settings.notifyWebhookUrl ?? "",
    notifyWebhookSecret: settings.notifyWebhookSecret ?? "",
    processorCapacity: settings.processorCapacity ?? {},
  };
}

function processorLabel(key: string) {
  return ProcessorKeyLabels[key] ?? key;
}

function processorDescription(key: string) {
  return ProcessorKeyDescriptions[key] ?? "";
}

function backendLabel(
  backendId: string | undefined,
  activeBackends: Array<{ id: string; name: string; isDefault: boolean }>,
) {
  if (!backendId || backendId === NONE_BACKEND_VALUE) return "None";
  const selected = activeBackends.find((backend) => backend.id === backendId);
  if (!selected) return "Select a backend";
  return selected.isDefault ? `${selected.name} (default)` : selected.name;
}

export function OrgProcessingSettingsForm({ orgId }: { orgId: string }) {
  const { activeOrg } = useActiveOrg();
  const query = useOrgProcessingSettingsQuery(orgId);
  const updateMutation = useUpdateOrgProcessingSettingsMutation(orgId);
  const processorBackends = useProcessorBackendsQuery(orgId);
  const [form, setForm] = useState<FormState | null>(null);
  const [activeTab, setActiveTab] = useState<string>("images");
  const [visionBackendPickerOpen, setVisionBackendPickerOpen] = useState(false);
  const [ocrBackendPickerOpen, setOcrBackendPickerOpen] = useState(false);
  const [virusBackendPickerOpen, setVirusBackendPickerOpen] = useState(false);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  const activeBackends = useMemo(
    () =>
      (processorBackends.data?.items ?? []).filter(
        (backend) => backend.isActive,
      ),
    [processorBackends.data?.items],
  );

  const openaiBackends = useMemo(
    () =>
      activeBackends.filter(
        (backend) => backend.kind === "openai_compatible",
      ),
    [activeBackends],
  );

  const clamavBackends = useMemo(
    () => activeBackends.filter((backend) => backend.kind === "clamav"),
    [activeBackends],
  );

  const backendsSettingsHref = activeOrg
    ? PAGE_ROUTES.settingsProcessorBackends(activeOrg.slug)
    : "#";

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

  const patch = (partial: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...partial } : current));

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {PROCESSOR_GROUPS.map((group) => {
          const enabledCount = group.processors.filter(
            (processor) => form[processor.enabledKey],
          ).length;
          const total = group.processors.length;
          return (
            <TabsTrigger
              key={group.id}
              value={group.id}
              className="gap-1.5 px-3"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  enabledCount === 0
                    ? "bg-muted-foreground/40"
                    : enabledCount === total
                      ? "bg-emerald-500"
                      : "bg-amber-500",
                )}
                aria-hidden
              />
              {group.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {PROCESSOR_GROUPS.map((group) => (
        <TabsContent key={group.id} value={group.id} className="mt-0">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>

              <div className="space-y-3">
                {group.processors.map((processor) => {
                  const enabled = form[processor.enabledKey];
                  const switchId = `processor-${processor.key.replace(/\./g, "-")}`;
                  return (
                    <div
                      key={processor.key}
                      className="space-y-3 rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label
                              htmlFor={switchId}
                              className="text-sm font-semibold"
                            >
                              {processorLabel(processor.key)}
                            </Label>
                            <Badge
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {processor.key}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {processorDescription(processor.key)}
                          </p>
                        </div>
                        <Switch
                          id={switchId}
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            patch({ [processor.enabledKey]: checked })
                          }
                        />
                      </div>

                      {!enabled ? (
                        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          Off — {processor.whenDisabled}
                        </p>
                      ) : (
                        <div className="space-y-3 border-t pt-3">
                          <ProcessorCapacityFields
                            processorKey={processor.key}
                            capacity={
                              form.processorCapacity[processor.key] ?? {
                                concurrency: 1,
                                rateMax: null,
                                rateDurationMs: null,
                              }
                            }
                            onChange={(next) =>
                              patch({
                                processorCapacity: {
                                  ...form.processorCapacity,
                                  [processor.key]: next,
                                },
                              })
                            }
                          />
                          <ProcessorTabOptions
                            orgId={orgId}
                            processorKey={processor.key}
                            form={form}
                            patch={patch}
                            visionBackendPickerOpen={visionBackendPickerOpen}
                            setVisionBackendPickerOpen={
                              setVisionBackendPickerOpen
                            }
                            ocrBackendPickerOpen={ocrBackendPickerOpen}
                            setOcrBackendPickerOpen={setOcrBackendPickerOpen}
                            virusBackendPickerOpen={virusBackendPickerOpen}
                            setVirusBackendPickerOpen={setVirusBackendPickerOpen}
                            openaiBackends={openaiBackends}
                            clamavBackends={clamavBackends}
                            backendsSettingsHref={backendsSettingsHref}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}

      <div className="flex justify-end">
        <Button
          disabled={updateMutation.isPending}
          onClick={() => saveForm(form, updateMutation.mutate)}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save processing"
          )}
        </Button>
      </div>
    </Tabs>
  );
}

function ProcessorTabOptions({
  orgId,
  processorKey,
  form,
  patch,
  visionBackendPickerOpen,
  setVisionBackendPickerOpen,
  ocrBackendPickerOpen,
  setOcrBackendPickerOpen,
  virusBackendPickerOpen,
  setVirusBackendPickerOpen,
  openaiBackends,
  clamavBackends,
  backendsSettingsHref,
}: {
  orgId: string;
  processorKey: string;
  form: FormState;
  patch: (partial: Partial<FormState>) => void;
  visionBackendPickerOpen: boolean;
  setVisionBackendPickerOpen: (open: boolean) => void;
  ocrBackendPickerOpen: boolean;
  setOcrBackendPickerOpen: (open: boolean) => void;
  virusBackendPickerOpen: boolean;
  setVirusBackendPickerOpen: (open: boolean) => void;
  openaiBackends: Array<{
    id: string;
    name: string;
    kind: string;
    isDefault: boolean;
  }>;
  clamavBackends: Array<{
    id: string;
    name: string;
    kind: string;
    isDefault: boolean;
  }>;
  backendsSettingsHref: string;
}) {
  if (processorKey === ProcessorKey.SECURITY_VIRUS_SCAN) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Scans stored bytes via ClamAV (clamd). Infected files are quarantined
          (soft-deleted) and stop serving. Prefer enabling this early in the
          pipeline. Create a ClamAV backend under Settings → Processor backends.
        </p>
        <BackendPickerField
          label="ClamAV backend"
          description="Org-scoped ClamAV/clamd connection (host:port). Only backends of kind clamav are listed."
          value={form.virusScanBackendId}
          selectedLabel={backendLabel(form.virusScanBackendId, clamavBackends)}
          open={virusBackendPickerOpen}
          onOpenChange={setVirusBackendPickerOpen}
          activeBackends={clamavBackends}
          backendsSettingsHref={backendsSettingsHref}
          onSelect={(id) => patch({ virusScanBackendId: id })}
          emptyHint="No active ClamAV backends yet."
        />
      </div>
    );
  }

  if (processorKey === ProcessorKey.IMAGE_NORMALIZE) {
    return (
      <p className="text-xs text-muted-foreground">
        Runs first for HEIC/HEIF and animated GIF. Writes a JPEG{" "}
        <code className="rounded bg-muted px-1">normalized</code> artifact that
        variants, AI, and pHash prefer.
      </p>
    );
  }

  if (processorKey === ProcessorKey.IMAGE_VARIANTS) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Apps request these by name (
          <code className="rounded bg-muted px-1">variant=thumbnail</code> or{" "}
          <code className="rounded bg-muted px-1">medium</code>). Max edge is
          the longest side; aspect ratio is preserved (no crop, no upscale).
        </p>
        <VariantSlotRow
          label="Thumbnail"
          description="Lists, avatars, and compact previews. Typical: 160–320px."
          enabled={form.thumbnailEnabled}
          maxEdge={form.thumbnailMaxEdge}
          onEnabledChange={(checked) => patch({ thumbnailEnabled: checked })}
          onMaxEdgeChange={(maxEdge) => patch({ thumbnailMaxEdge: maxEdge })}
        />
        <VariantSlotRow
          label="Medium"
          description="Detail views and larger previews. Typical: 800–1600px."
          enabled={form.mediumEnabled}
          maxEdge={form.mediumMaxEdge}
          onEnabledChange={(checked) => patch({ mediumEnabled: checked })}
          onMaxEdgeChange={(maxEdge) => patch({ mediumMaxEdge: maxEdge })}
        />
        <div className="space-y-2">
          <Label>Output formats</Label>
          <p className="text-xs text-muted-foreground">
            Each enabled variant is encoded in every selected format. WebP is a
            safe default; AVIF is smaller but slower to encode.
          </p>
          <div className="flex flex-wrap gap-4 rounded-md border bg-muted/20 px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.formatWebp}
                onCheckedChange={(checked) =>
                  patch({ formatWebp: checked === true })
                }
              />
              WebP
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.formatAvif}
                onCheckedChange={(checked) =>
                  patch({ formatAvif: checked === true })
                }
              />
              AVIF
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (processorKey === ProcessorKey.METADATA_EXIF) {
    return (
      <p className="text-xs text-muted-foreground">
        No extra options. Results appear under the file&apos;s processor results
        as camera, GPS, and tag metadata when present.
      </p>
    );
  }

  if (processorKey === ProcessorKey.VIDEO_PREVIEW) {
    return (
      <div className="space-y-4">
        <ToggleRow
          label="Poster thumbnail"
          description="Capture a first-frame (or early) still used as the video poster."
          checked={form.videoThumbnail}
          onCheckedChange={(checked) => patch({ videoThumbnail: checked })}
        />
        <div className="space-y-2">
          <Label htmlFor="preview-frames">Preview frames</Label>
          <p className="text-xs text-muted-foreground">
            Extra stills sampled across the clip (0–30). Use 0 for poster only;
            3 is a light default for scrubbing UIs.
          </p>
          <Input
            id="preview-frames"
            type="number"
            min={0}
            max={30}
            className="max-w-40"
            value={form.videoPreviewFrames}
            onChange={(e) =>
              patch({ videoPreviewFrames: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>
    );
  }

  if (processorKey === ProcessorKey.DOCUMENT_PREVIEW) {
    return (
      <p className="text-xs text-muted-foreground">
        Requires <code className="rounded bg-muted px-1">pdftoppm</code>{" "}
        (Poppler) on the worker. Also used as the image source for OCR on
        scanned PDFs.
      </p>
    );
  }

  if (processorKey === ProcessorKey.DOCUMENT_TEXT) {
    return (
      <p className="text-xs text-muted-foreground">
        Extracts embedded text only — not OCR. Prefer this for searchable PDFs;
        enable OCR when pages are image-only scans.
      </p>
    );
  }

  if (processorKey === ProcessorKey.DOCUMENT_OCR) {
    const usesRemoteEngine = form.documentOcrEngine === "openai_compatible";
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Runs when native text is missing or too short. For PDFs, enable
          Document preview so a page image exists to OCR.
        </p>
        <div className="space-y-2">
          <Label>OCR engine</Label>
          <Select
            value={form.documentOcrEngine}
            onValueChange={(value) => {
              if (value == null) return;
              patch({
                documentOcrEngine: value as "openai_compatible" | "tesseract",
              });
            }}
          >
            <SelectTrigger className="h-9 w-full max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai_compatible">
                OpenAI-compatible vision
              </SelectItem>
              <SelectItem value="tesseract">
                Local tesseract (no API key)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            OpenAI-compatible uses its own processor backend below. Tesseract
            needs the binary on the worker image.
          </p>
        </div>
        {usesRemoteEngine ? (
          <>
            <BackendPickerField
              label="OCR processor backend"
              description="Connection only — pick an active OpenAI-compatible backend. Model is chosen separately below."
              value={form.documentOcrBackendId}
              selectedLabel={backendLabel(
                form.documentOcrBackendId,
                openaiBackends,
              )}
              open={ocrBackendPickerOpen}
              onOpenChange={setOcrBackendPickerOpen}
              activeBackends={openaiBackends}
              backendsSettingsHref={backendsSettingsHref}
              onSelect={(id) => patch({ documentOcrBackendId: id })}
              emptyHint="No active OpenAI-compatible backends yet."
            />
            <BackendModelPicker
              orgId={orgId}
              backendId={
                form.documentOcrBackendId !== NONE_BACKEND_VALUE
                  ? form.documentOcrBackendId
                  : null
              }
              value={form.documentOcrVisionModel}
              onChange={(documentOcrVisionModel) =>
                patch({ documentOcrVisionModel })
              }
              label="OCR vision model"
              description="Model used for document page OCR on this processor."
              placeholder="llava"
            />
          </>
        ) : null}
      </div>
    );
  }

  if (processorKey === ProcessorKey.INTEGRITY_VERIFY) {
    return (
      <p className="text-xs text-muted-foreground">
        Streams the object from storage and compares hashes. Failures mark the
        job failed; you can also run Verify from a file&apos;s actions.
      </p>
    );
  }

  if (processorKey === ProcessorKey.DEDUPE_PHASH) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Soft flag only — files are still stored. Review matches on the file
          detail Dupes tab (confirm or dismiss).
        </p>
        <div className="space-y-2">
          <Label htmlFor="phash-threshold">Hamming threshold (bits)</Label>
          <p className="text-xs text-muted-foreground">
            Max bit difference to treat as a near-duplicate (0–64). Lower =
            stricter. Default 10 is a balanced start.
          </p>
          <Input
            id="phash-threshold"
            type="number"
            min={0}
            max={64}
            className="max-w-40"
            value={form.phashThresholdBits}
            onChange={(e) =>
              patch({ phashThresholdBits: Number(e.target.value) || 10 })
            }
          />
        </div>
      </div>
    );
  }

  if (processorKey === ProcessorKey.AI_VISION) {
    return (
      <div className="space-y-4">
        <BackendPickerField
          label="Processor backend"
          description="Connection only — choose an active OpenAI-compatible backend (Ollama, vLLM, OpenAI, etc.)."
          value={form.aiBackendId}
          selectedLabel={backendLabel(form.aiBackendId, openaiBackends)}
          open={visionBackendPickerOpen}
          onOpenChange={setVisionBackendPickerOpen}
          activeBackends={openaiBackends}
          backendsSettingsHref={backendsSettingsHref}
          onSelect={(id) => patch({ aiBackendId: id })}
          emptyHint="No active OpenAI-compatible backends yet."
        />

        <BackendModelPicker
          orgId={orgId}
          backendId={
            form.aiBackendId !== NONE_BACKEND_VALUE ? form.aiBackendId : null
          }
          value={form.aiVisionModel}
          onChange={(aiVisionModel) => patch({ aiVisionModel })}
          label="Vision model"
          description="Model used for captions, tags, and NSFW scoring on this processor."
          placeholder="llava"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleRow
            label="Captions"
            description="Short natural-language description of the image."
            checked={form.enableAiCaption}
            onCheckedChange={(checked) => patch({ enableAiCaption: checked })}
          />
          <ToggleRow
            label="Tags"
            description="Searchable keyword tags from the model."
            checked={form.enableAiTags}
            onCheckedChange={(checked) => patch({ enableAiTags: checked })}
          />
          <ToggleRow
            label="NSFW score"
            description="Unsafe-content score for moderation workflows."
            checked={form.enableAiNsfw}
            onCheckedChange={(checked) => patch({ enableAiNsfw: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nsfw-threshold">NSFW flag threshold</Label>
          <p className="text-xs text-muted-foreground">
            Score from 0–1. Values at or above this threshold are treated as
            NSFW. Typical start: 0.7.
          </p>
          <Input
            id="nsfw-threshold"
            type="number"
            min={0}
            max={1}
            step={0.01}
            className="max-w-40"
            value={form.nsfwThreshold}
            disabled={!form.enableAiNsfw}
            onChange={(event) =>
              patch({ nsfwThreshold: Number(event.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  if (processorKey === ProcessorKey.NOTIFY_WEBHOOK) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          External HTTP endpoint for this processor. Configure the target URL
          (and optional HMAC secret) here — fired from the processing rollup
          (completed / failed / partial), not as a MIME-scheduled job.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={form.notifyWebhookUrl}
              onChange={(e) => patch({ notifyWebhookUrl: e.target.value })}
              placeholder="https://example.com/hooks/storage"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-secret">HMAC secret</Label>
            <Input
              id="webhook-secret"
              value={form.notifyWebhookSecret}
              onChange={(e) => patch({ notifyWebhookSecret: e.target.value })}
              placeholder="optional signing secret"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function saveForm(
  form: FormState,
  mutate: ReturnType<
    typeof useUpdateOrgProcessingSettingsMutation
  >["mutate"],
) {
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
  if (form.thumbnailEnabled && form.mediumEnabled && thumb > med) {
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
  if (
    form.enableVirusScan &&
    (!form.virusScanBackendId || form.virusScanBackendId === NONE_BACKEND_VALUE)
  ) {
    toast.error("Select a ClamAV backend for virus scan");
    return;
  }
  if (
    form.enableAiProcessing &&
    (!form.aiBackendId || form.aiBackendId === NONE_BACKEND_VALUE)
  ) {
    toast.error("Select a processor backend for AI processing");
    return;
  }
  if (form.enableAiProcessing && !form.aiVisionModel.trim()) {
    toast.error("Select or enter a vision model for AI processing");
    return;
  }
  if (
    form.enableDocumentOcr &&
    form.documentOcrEngine === "openai_compatible" &&
    (!form.documentOcrBackendId ||
      form.documentOcrBackendId === NONE_BACKEND_VALUE)
  ) {
    toast.error("Select a processor backend for Document OCR");
    return;
  }
  if (
    form.enableDocumentOcr &&
    form.documentOcrEngine === "openai_compatible" &&
    !form.documentOcrVisionModel.trim()
  ) {
    toast.error("Select or enter a vision model for Document OCR");
    return;
  }
  if (
    !Number.isFinite(form.nsfwThreshold) ||
    form.nsfwThreshold < 0 ||
    form.nsfwThreshold > 1
  ) {
    toast.error("NSFW threshold must be between 0 and 1");
    return;
  }
  if (
    form.enableNotifyWebhook &&
    form.notifyWebhookUrl.trim().length === 0
  ) {
    toast.error("Webhook URL is required when the completion webhook is on");
    return;
  }

  mutate(
    {
      enableImageProcessing: form.enableImageProcessing,
      enableVideoProcessing: form.enableVideoProcessing,
      enableMetadataExtraction: form.enableMetadataExtraction,
      enableAiProcessing: form.enableAiProcessing,
      enableAiCaption: form.enableAiCaption,
      enableAiTags: form.enableAiTags,
      enableAiNsfw: form.enableAiNsfw,
      nsfwThreshold: form.nsfwThreshold,
      aiBackendId:
        form.aiBackendId && form.aiBackendId !== NONE_BACKEND_VALUE
          ? form.aiBackendId
          : null,
      aiVisionModel: form.aiVisionModel.trim() || null,
      documentOcrBackendId:
        form.documentOcrBackendId &&
        form.documentOcrBackendId !== NONE_BACKEND_VALUE
          ? form.documentOcrBackendId
          : null,
      documentOcrVisionModel: form.documentOcrVisionModel.trim() || null,
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
      enableImageNormalize: form.enableImageNormalize,
      enableDedupePhash: form.enableDedupePhash,
      phashThresholdBits: form.phashThresholdBits,
      enableIntegrityVerify: form.enableIntegrityVerify,
      enableVirusScan: form.enableVirusScan,
      virusScanBackendId:
        form.virusScanBackendId &&
        form.virusScanBackendId !== NONE_BACKEND_VALUE
          ? form.virusScanBackendId
          : null,
      enableDocumentPreview: form.enableDocumentPreview,
      enableDocumentText: form.enableDocumentText,
      enableDocumentOcr: form.enableDocumentOcr,
      documentOcrEngine: form.documentOcrEngine,
      enableNotifyWebhook: form.enableNotifyWebhook,
      notifyWebhookUrl: form.notifyWebhookUrl,
      notifyWebhookSecret: form.notifyWebhookSecret,
      processorCapacity: form.processorCapacity,
    },
    {
      onSuccess: () => toast.success("Processing settings saved"),
      onError: (err) =>
        toast.error(extractApiErrorMessage(err, "Save failed")),
    },
  );
}

function BackendPickerField({
  label,
  description,
  value,
  selectedLabel,
  open,
  onOpenChange,
  activeBackends,
  backendsSettingsHref,
  onSelect,
  emptyHint,
}: {
  label: string;
  description: string;
  value: string;
  selectedLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBackends: Array<{
    id: string;
    name: string;
    kind: string;
    isDefault: boolean;
  }>;
  backendsSettingsHref: string;
  onSelect: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      {activeBackends.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {emptyHint ?? "No active processor backends yet."}{" "}
          <Link
            href={backendsSettingsHref}
            className="font-medium underline underline-offset-2"
          >
            Add one in Settings → Processor backends
          </Link>
          .
        </div>
      ) : null}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full max-w-md justify-between font-normal"
          >
            <span
              className={cn(
                "truncate",
                value === NONE_BACKEND_VALUE && "text-muted-foreground",
              )}
            >
              {selectedLabel}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search backends..." />
            <CommandList>
              <CommandEmpty>No backend found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="None"
                  onSelect={() => {
                    onSelect(NONE_BACKEND_VALUE);
                    onOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === NONE_BACKEND_VALUE
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  None
                </CommandItem>
                {activeBackends.map((backend) => {
                  const itemLabel = backend.isDefault
                    ? `${backend.name} (default)`
                    : backend.name;
                  return (
                    <CommandItem
                      key={backend.id}
                      value={`${backend.name} ${backend.kind} ${itemLabel}`}
                      onSelect={() => {
                        onSelect(backend.id);
                        onOpenChange(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value === backend.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{itemLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ProcessorCapacityFields({
  processorKey,
  capacity,
  onChange,
}: {
  processorKey: string;
  capacity: {
    concurrency: number;
    rateMax: number | null;
    rateDurationMs: number | null;
  };
  onChange: (next: {
    concurrency: number;
    rateMax: number | null;
    rateDurationMs: number | null;
  }) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${processorKey}-concurrency`}>Concurrency</Label>
        <Input
          id={`${processorKey}-concurrency`}
          type="number"
          min={1}
          max={32}
          className="h-8"
          value={capacity.concurrency}
          onChange={(e) =>
            onChange({
              ...capacity,
              concurrency: Math.min(32, Math.max(1, Number(e.target.value) || 1)),
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${processorKey}-rate-max`}>Rate max</Label>
        <Input
          id={`${processorKey}-rate-max`}
          type="number"
          min={0}
          className="h-8"
          placeholder="∞"
          value={capacity.rateMax ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange({
              ...capacity,
              rateMax: v === "" ? null : Math.max(1, Number(v) || 1),
            });
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${processorKey}-rate-window`}>Rate window (ms)</Label>
        <Input
          id={`${processorKey}-rate-window`}
          type="number"
          min={0}
          className="h-8"
          placeholder="—"
          value={capacity.rateDurationMs ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange({
              ...capacity,
              rateDurationMs: v === "" ? null : Math.max(1000, Number(v) || 1000),
            });
          }}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border p-3",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
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
}: {
  label: string;
  description: string;
  enabled: boolean;
  maxEdge: number;
  onEnabledChange: (checked: boolean) => void;
  onMaxEdgeChange: (maxEdge: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="mt-0.5"
        />
        <div className="min-w-0 space-y-0.5">
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
          disabled={!enabled}
          onChange={(e) => onMaxEdgeChange(Number(e.target.value) || 0)}
          aria-label={`${label} max width`}
        />
        <span className="shrink-0 text-xs text-muted-foreground">px</span>
      </div>
    </div>
  );
}
