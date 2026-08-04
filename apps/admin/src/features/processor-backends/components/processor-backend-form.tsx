"use client";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ResponsiveSheet,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@workspace/ui/components";
import {
  ProcessorBackendKind,
  ProcessorBackendKindLabels,
  processorBackendFormSchema,
  zodFirstMessage,
  zodFlatFields,
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
  const [kind, setKind] = useState<
    | typeof ProcessorBackendKind.OPENAI_COMPATIBLE
    | typeof ProcessorBackendKind.CLAMAV
  >(
    initialValues?.kind === ProcessorBackendKind.CLAMAV
      ? ProcessorBackendKind.CLAMAV
      : ProcessorBackendKind.OPENAI_COMPATIBLE,
  );
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isClamav = kind === ProcessorBackendKind.CLAMAV;

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const parsedTimeout = Number(timeoutMs);
        const candidate = {
          name: name.trim(),
          kind,
          isActive,
          isDefault,
          baseUrl: baseUrl.trim(),
          apiKey: isClamav ? "" : apiKey,
          clearApiKey: isClamav ? false : clearApiKey,
          visionModel: isClamav ? "" : visionModel.trim(),
          textModel: isClamav ? "" : textModel.trim(),
          timeoutMs: Number.isFinite(parsedTimeout)
            ? parsedTimeout
            : Number.NaN,
        };
        const parsed = processorBackendFormSchema.safeParse(candidate);
        if (!parsed.success) {
          const flat = zodFlatFields(parsed.error);
          setFieldErrors(flat.fields);
          toast.error(zodFirstMessage(parsed.error, "Invalid backend"));
          return;
        }
        setFieldErrors({});
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
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
            placeholder={isClamav ? "local-clamav" : "local-ollama"}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          <FieldError message={fieldErrors.name} />
        </div>

        <div className="space-y-2">
          <Label>Kind</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              if (
                value === ProcessorBackendKind.OPENAI_COMPATIBLE ||
                value === ProcessorBackendKind.CLAMAV
              ) {
                setKind(value);
                clearFieldError("kind");
                clearFieldError("baseUrl");
              }
            }}
            disabled={Boolean(initialValues)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {ProcessorBackendKindLabels[kind] ?? kind}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ProcessorBackendKind.OPENAI_COMPATIBLE}>
                {
                  ProcessorBackendKindLabels[
                    ProcessorBackendKind.OPENAI_COMPATIBLE
                  ]
                }
              </SelectItem>
              <SelectItem value={ProcessorBackendKind.CLAMAV}>
                {ProcessorBackendKindLabels[ProcessorBackendKind.CLAMAV]}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="processor-backend-url">
            {isClamav ? "Clamd host *" : "Base URL *"}
          </Label>
          <Input
            id="processor-backend-url"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              clearFieldError("baseUrl");
            }}
            placeholder={isClamav ? "clamav:3310" : "http://ollama:11434/v1"}
            aria-invalid={Boolean(fieldErrors.baseUrl)}
          />
          <p className="text-xs text-muted-foreground">
            {isClamav
              ? "Reachable clamd address (host:port). Workers use the internal Docker hostname."
              : "OpenAI-compatible API root, including `/v1` when required."}
          </p>
          <FieldError message={fieldErrors.baseUrl} />
        </div>

        {!isClamav ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="processor-backend-api-key">API key</Label>
              <Input
                id="processor-backend-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  clearFieldError("apiKey");
                }}
                disabled={clearApiKey}
                autoComplete="new-password"
                placeholder={
                  initialValues?.apiKeyConfigured
                    ? `Configured (ends in ${initialValues.apiKeyLast4 ?? "••••"})`
                    : "Optional"
                }
                aria-invalid={Boolean(fieldErrors.apiKey)}
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
              <FieldError message={fieldErrors.apiKey} />
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Default models (fallback)</p>
                <p className="text-xs text-muted-foreground">
                  Optional. Prefer setting vision/text models on each processor
                  in Processing settings. These are used only when a processor
                  has no model configured.
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
                    onChange={(event) => {
                      setVisionModel(event.target.value);
                      clearFieldError("visionModel");
                    }}
                    placeholder="llava"
                    aria-invalid={Boolean(fieldErrors.visionModel)}
                  />
                  <FieldError message={fieldErrors.visionModel} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="processor-backend-text-model">
                    Fallback text model
                  </Label>
                  <Input
                    id="processor-backend-text-model"
                    value={textModel}
                    onChange={(event) => {
                      setTextModel(event.target.value);
                      clearFieldError("textModel");
                    }}
                    placeholder="llama3.2"
                    aria-invalid={Boolean(fieldErrors.textModel)}
                  />
                  <FieldError message={fieldErrors.textModel} />
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="processor-backend-timeout">Timeout (ms)</Label>
          <Input
            id="processor-backend-timeout"
            type="number"
            min={1_000}
            max={600_000}
            value={timeoutMs}
            onChange={(event) => {
              setTimeoutMs(event.target.value);
              clearFieldError("timeoutMs");
            }}
            aria-invalid={Boolean(fieldErrors.timeoutMs)}
          />
          <FieldError message={fieldErrors.timeoutMs} />
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
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
