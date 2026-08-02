"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { Button, Input, Label } from "@workspace/ui/components";
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type OrgLimitsSettings,
  type OrgUsageBreakdownCategory,
  type OrgUsageSnapshot,
  useOrgLimitsQuery,
  useOrgUsageQuery,
  useUpdateOrgLimitsMutation,
} from "../hooks/use-orgs-queries";

type FormState = {
  maxFileSizeBytes: string;
  allowedMimeTypesText: string;
  storageQuotaBytes: string;
  maxObjectCount: string;
};

const SEGMENT_COLORS: Record<OrgUsageBreakdownCategory, string> = {
  documents: "bg-blue-500",
  images: "bg-emerald-500",
  videos: "bg-amber-500",
  audio: "bg-purple-500",
  other: "bg-slate-500",
};

function formatBytesParts(n: number): { value: string; unit: string } {
  if (!Number.isFinite(n) || n <= 0) return { value: "0", unit: "B" };
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const formatted =
    value < 10 && i > 0
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : Math.round(value).toLocaleString();
  return { value: formatted, unit: units[i]! };
}

function formatBytes(n: number): string {
  const { value, unit } = formatBytesParts(n);
  return `${value} ${unit}`;
}

function emptyToNullNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function toForm(limits: OrgLimitsSettings): FormState {
  return {
    maxFileSizeBytes:
      limits.maxFileSizeBytes != null ? String(limits.maxFileSizeBytes) : "",
    allowedMimeTypesText: (limits.allowedMimeTypes ?? []).join(", "),
    storageQuotaBytes:
      limits.storageQuotaBytes != null ? String(limits.storageQuotaBytes) : "",
    maxObjectCount:
      limits.maxObjectCount != null ? String(limits.maxObjectCount) : "",
  };
}

function UsageMeter({ usage }: { usage: OrgUsageSnapshot }) {
  const quota = usage.storageQuotaBytes;
  const hasQuota = quota != null && quota > 0;
  const totalBytes = hasQuota ? quota : Math.max(usage.usedBytes, 1);
  const freeBytes = hasQuota ? Math.max(0, quota - usage.usedBytes) : 0;
  const usedParts = formatBytesParts(usage.usedBytes);
  const totalParts = hasQuota ? formatBytesParts(quota) : null;

  const segments = (usage.breakdown ?? [])
    .filter((segment) => segment.bytes > 0)
    .map((segment) => ({
      ...segment,
      color: SEGMENT_COLORS[segment.category] ?? SEGMENT_COLORS.other,
    }));

  return (
    <Card className="w-full shadow-sm">
      <CardContent className="space-y-4 py-0">
        <div>
          <p className="mb-1 text-pretty text-base text-muted-foreground">
            Using Storage{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {usedParts.value} {usedParts.unit}
            </span>
            {totalParts ? (
              <>
                {" "}
                of {totalParts.value} {totalParts.unit}
              </>
            ) : (
              <> of unlimited</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Soft-deleted files still count until hard purge.
          </p>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {segments.length > 0 ? (
            segments.map((segment) => {
              const percentage = Math.min(
                100,
                (segment.bytes / totalBytes) * 100,
              );
              return (
                <div
                  aria-label={segment.label}
                  aria-valuemax={totalBytes}
                  aria-valuemin={0}
                  aria-valuenow={segment.bytes}
                  className={cn("h-full", segment.color)}
                  key={segment.category}
                  role="progressbar"
                  style={{ width: `${percentage}%` }}
                />
              );
            })
          ) : (
            <div
              aria-label="Used"
              aria-valuemax={totalBytes}
              aria-valuemin={0}
              aria-valuenow={usage.usedBytes}
              className="h-full bg-primary"
              role="progressbar"
              style={{
                width: `${hasQuota ? Math.min(100, (usage.usedBytes / totalBytes) * 100) : 0}%`,
              }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {segments.map((segment) => (
            <div className="flex items-center gap-2" key={segment.category}>
              <span
                aria-hidden="true"
                className={cn("size-3 shrink-0 rounded", segment.color)}
              />
              <span className="text-sm text-muted-foreground">
                {segment.label}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatBytes(segment.bytes)}
              </span>
            </div>
          ))}
          {hasQuota && (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-sm bg-muted"
              />
              <span className="text-sm text-muted-foreground">Free</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatBytes(freeBytes)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span>
            Objects:{" "}
            <span className="font-mono text-foreground">
              {usage.objectCount.toLocaleString()}
            </span>
            {usage.maxObjectCount != null
              ? ` / ${usage.maxObjectCount.toLocaleString()}`
              : " / unlimited"}
          </span>
          <span>
            Max file:{" "}
            <span className="font-mono text-foreground">
              {formatBytes(usage.maxFileSizeBytes)}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrgLimitsSettingsForm({ orgId }: { orgId: string }) {
  const usageQuery = useOrgUsageQuery(orgId);
  const limitsQuery = useOrgLimitsQuery(orgId);
  const updateMutation = useUpdateOrgLimitsMutation(orgId);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (limitsQuery.data) setForm(toForm(limitsQuery.data));
  }, [limitsQuery.data]);

  if (usageQuery.isLoading || limitsQuery.isLoading || !form) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading limits…
      </div>
    );
  }

  if (usageQuery.error || limitsQuery.error) {
    return (
      <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
        Failed to load limits or usage
      </div>
    );
  }

  const defaults = limitsQuery.data?.defaults;

  return (
    <div className="space-y-5">
      {usageQuery.data && <UsageMeter usage={usageQuery.data} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="max-file-size">Max file size (bytes)</Label>
          <Input
            id="max-file-size"
            inputMode="numeric"
            value={form.maxFileSizeBytes}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, maxFileSizeBytes: e.target.value } : f,
              )
            }
            placeholder={
              defaults
                ? `Platform default: ${defaults.maxFileSizeBytes}`
                : "Platform default"
            }
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use the platform max. Org cannot exceed platform
            ceiling.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="storage-quota">Storage quota (bytes)</Label>
          <Input
            id="storage-quota"
            inputMode="numeric"
            value={form.storageQuotaBytes}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, storageQuotaBytes: e.target.value } : f,
              )
            }
            placeholder="Unlimited"
          />
          <p className="text-xs text-muted-foreground">
            Empty = unlimited. Example: 10737418240 for 10 GB.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-objects">Max object count</Label>
          <Input
            id="max-objects"
            inputMode="numeric"
            value={form.maxObjectCount}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, maxObjectCount: e.target.value } : f,
              )
            }
            placeholder="Unlimited"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="mime-types">Allowed MIME types</Label>
          <Input
            id="mime-types"
            value={form.allowedMimeTypesText}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, allowedMimeTypesText: e.target.value } : f,
              )
            }
            placeholder="image/jpeg, image/png, application/pdf"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Empty = platform allowlist (or allow all if
            platform is empty).
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={updateMutation.isPending}
          onClick={() => {
            const mimeParts = form.allowedMimeTypesText
              .split(/[,\s]+/)
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean);
            updateMutation.mutate(
              {
                maxFileSizeBytes: emptyToNullNumber(form.maxFileSizeBytes),
                storageQuotaBytes: emptyToNullNumber(form.storageQuotaBytes),
                maxObjectCount: emptyToNullNumber(form.maxObjectCount),
                allowedMimeTypes: mimeParts.length > 0 ? mimeParts : null,
              },
              {
                onSuccess: () => toast.success("Limits saved"),
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
            "Save limits"
          )}
        </Button>
      </div>
    </div>
  );
}
