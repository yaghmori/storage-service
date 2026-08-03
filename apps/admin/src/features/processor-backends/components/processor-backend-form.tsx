"use client";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ResponsiveSheet,
  Switch,
} from "@workspace/ui/components";
import {
  ProcessorBackendKind,
  ProcessorBackendKindLabels,
  processorBackendFormSchema,
} from "@workspace/validation";
import { useState } from "react";
import { toast } from "sonner";
import type {
  ProcessorBackendRow,
  UpsertProcessorBackendInput,
} from "../hooks/use-processor-backends-queries";

export function ProcessorBackendForm({
  initialValues,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: ProcessorBackendRow;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: UpsertProcessorBackendInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initialValues?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [visionModel, setVisionModel] = useState(
    initialValues?.visionModel ?? "",
  );
  const [textModel, setTextModel] = useState(initialValues?.textModel ?? "");
  const [timeoutMs, setTimeoutMs] = useState(
    String(initialValues?.timeoutMs ?? 60_000),
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initialValues?.isDefault ?? false);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const candidate = {
          name: name.trim(),
          kind: ProcessorBackendKind.OPENAI_COMPATIBLE,
          isActive,
          isDefault,
          baseUrl: baseUrl.trim(),
          apiKey,
          clearApiKey,
          visionModel: visionModel.trim(),
          textModel: textModel.trim(),
          timeoutMs: Number(timeoutMs),
        };
        const parsed = processorBackendFormSchema.safeParse(candidate);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid backend");
          return;
        }
        onSubmit({
          ...parsed.data,
          apiKey: parsed.data.apiKey || undefined,
          visionModel: parsed.data.visionModel || undefined,
          textModel: parsed.data.textModel || undefined,
        });
      }}
    >
      <ResponsiveSheet.Content className="space-y-4 px-4 pb-4">
        <div className="space-y-2">
          <Label htmlFor="processor-backend-name">Name *</Label>
          <Input
            id="processor-backend-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="local-ollama"
          />
        </div>

        <div className="space-y-2">
          <Label>Kind</Label>
          <Input
            value={
              ProcessorBackendKindLabels[ProcessorBackendKind.OPENAI_COMPATIBLE]
            }
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="processor-backend-url">Base URL *</Label>
          <Input
            id="processor-backend-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://ollama:11434/v1"
          />
          <p className="text-xs text-muted-foreground">
            OpenAI-compatible API root, including `/v1` when required.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="processor-backend-api-key">API key</Label>
          <Input
            id="processor-backend-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            disabled={clearApiKey}
            autoComplete="new-password"
            placeholder={
              initialValues?.apiKeyConfigured
                ? `Configured (ends in ${initialValues.apiKeyLast4 ?? "••••"})`
                : "Optional"
            }
          />
          {initialValues?.apiKeyConfigured ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={clearApiKey}
                onCheckedChange={(checked) => {
                  setClearApiKey(checked === true);
                  if (checked === true) setApiKey("");
                }}
              />
              Clear configured API key
            </label>
          ) : null}
        </div>

        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Default models (fallback)</p>
            <p className="text-xs text-muted-foreground">
              Optional. Prefer setting vision/text models on each processor in
              Processing settings. These are used only when a processor has no
              model configured.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="processor-backend-vision-model">
                Fallback vision model
              </Label>
              <Input
                id="processor-backend-vision-model"
                value={visionModel}
                onChange={(event) => setVisionModel(event.target.value)}
                placeholder="llava"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processor-backend-text-model">
                Fallback text model
              </Label>
              <Input
                id="processor-backend-text-model"
                value={textModel}
                onChange={(event) => setTextModel(event.target.value)}
                placeholder="llama3.2"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="processor-backend-timeout">Timeout (ms)</Label>
          <Input
            id="processor-backend-timeout"
            type="number"
            min={1_000}
            max={600_000}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(event.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <Toggle
            label="Active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Toggle
            label="Default backend"
            checked={isDefault}
            onCheckedChange={setIsDefault}
          />
        </div>
      </ResponsiveSheet.Content>

      <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </ResponsiveSheet.Footer>
    </form>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
