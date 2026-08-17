"use client";

import { Input, Label } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

export type QuotaStepValue = {
  preset: string;
  customQuotaGb: string;
  maxFileSizeMb: string;
  maxObjectCount: string;
};

export const EMPTY_QUOTA_STEP: QuotaStepValue = {
  preset: "unlimited",
  customQuotaGb: "",
  maxFileSizeMb: "",
  maxObjectCount: "",
};

const PRESETS: {
  id: string;
  label: string;
  hint: string;
  gb: number | null;
}[] = [
  { id: "1gb", label: "1 GB", hint: "Prototypes", gb: 1 },
  { id: "10gb", label: "10 GB", hint: "Most teams", gb: 10 },
  { id: "100gb", label: "100 GB", hint: "Media heavy", gb: 100 },
  { id: "1tb", label: "1 TB", hint: "Archives", gb: 1024 },
  { id: "unlimited", label: "Unlimited", hint: "Platform default", gb: null },
  { id: "custom", label: "Custom", hint: "Set your own", gb: null },
];

function positiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** Translates the friendly step values into the org limits payload. */
export function quotaStepToLimits(value: QuotaStepValue): {
  storageQuotaBytes: number | null;
  maxFileSizeBytes: number | null;
  maxObjectCount: number | null;
} | null {
  const preset = PRESETS.find((p) => p.id === value.preset);
  const quotaGb =
    value.preset === "custom"
      ? positiveInt(value.customQuotaGb)
      : (preset?.gb ?? null);

  const storageQuotaBytes = quotaGb != null ? quotaGb * GIB : null;
  const maxFileSizeMb = positiveInt(value.maxFileSizeMb);
  const maxFileSizeBytes = maxFileSizeMb != null ? maxFileSizeMb * MIB : null;
  const maxObjectCount = positiveInt(value.maxObjectCount);

  if (
    storageQuotaBytes == null &&
    maxFileSizeBytes == null &&
    maxObjectCount == null
  ) {
    return null;
  }

  return { storageQuotaBytes, maxFileSizeBytes, maxObjectCount };
}

export function CreateOrgQuotaStep({
  value,
  onChange,
}: {
  value: QuotaStepValue;
  onChange: (next: QuotaStepValue) => void;
}) {
  const patch = (next: Partial<QuotaStepValue>) =>
    onChange({ ...value, ...next });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Storage quota</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const selected = value.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => patch({ preset: preset.id })}
                className={cn(
                  "relative rounded-lg border p-3 text-left transition-colors",
                  "hover:bg-accent/50",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border",
                )}
              >
                {selected ? (
                  <Check
                    aria-hidden="true"
                    className="absolute right-2 top-2 size-4 text-primary"
                  />
                ) : null}
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-xs text-muted-foreground">{preset.hint}</p>
              </button>
            );
          })}
        </div>

        {value.preset === "custom" ? (
          <div className="space-y-1.5">
            <Label htmlFor="custom-quota-gb">Custom quota (GB)</Label>
            <Input
              id="custom-quota-gb"
              inputMode="numeric"
              placeholder="250"
              value={value.customQuotaGb}
              onChange={(e) => patch({ customQuotaGb: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="create-max-file-size">Max file size (MB)</Label>
          <Input
            id="create-max-file-size"
            inputMode="numeric"
            placeholder="Platform default"
            value={value.maxFileSizeMb}
            onChange={(e) => patch({ maxFileSizeMb: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Cannot exceed the platform ceiling.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-max-objects">Max object count</Label>
          <Input
            id="create-max-objects"
            inputMode="numeric"
            placeholder="Unlimited"
            value={value.maxObjectCount}
            onChange={(e) => patch({ maxObjectCount: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Total number of stored files.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Everything here can be changed later in organization settings.
      </p>
    </div>
  );
}
