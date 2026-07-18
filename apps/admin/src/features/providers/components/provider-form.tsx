"use client";

import {
  ProviderType,
  ProviderTypeLabels,
  providerFormSchema,
} from "@workspace/validation";
import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import { useEffect } from "react";
import type {
  ProviderRow,
  UpsertProviderInput,
} from "../hooks/use-providers-queries";

const DEFAULT_CONFIG_BY_TYPE: Record<ProviderType, string> = {
  [ProviderType.LOCAL]: JSON.stringify(
    { path: "/tmp/storage-uploads" },
    null,
    2,
  ),
  [ProviderType.MINIO]: JSON.stringify(
    {
      // Docker API → "minio" | host API → "localhost"
      endpoint: "minio",
      port: "9000",
      bucket: "storage",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      useSSL: false,
    },
    null,
    2,
  ),
  [ProviderType.S3]: JSON.stringify(
    {
      bucket: "my-bucket",
      region: "us-east-1",
      accessKeyId: "",
      secretAccessKey: "",
    },
    null,
    2,
  ),
};

export function ProviderForm({
  formId = "provider-form",
  initialValues,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  formId?: string;
  initialValues?: Partial<ProviderRow>;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: UpsertProviderInput) => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(initialValues?.id);

  const form = useAppForm({
    defaultValues: {
      name: initialValues?.name ?? "",
      type: initialValues?.type ?? ProviderType.LOCAL,
      configJson: initialValues?.config
        ? JSON.stringify(initialValues.config, null, 2)
        : DEFAULT_CONFIG_BY_TYPE[ProviderType.LOCAL],
      isActive: initialValues?.isActive ?? true,
      isDefault: initialValues?.isDefault ?? false,
    },
    validators: { onChange: providerFormSchema },
    onSubmit: async ({ value }) => {
      onSubmit({
        name: value.name.trim(),
        type: value.type,
        config: JSON.parse(value.configJson) as Record<string, unknown>,
        isActive: value.isActive,
        isDefault: value.isDefault,
      });
    },
  });

  useEffect(() => {
    if (isEdit) return;
    form.reset({
      name: "",
      type: ProviderType.LOCAL,
      configJson: DEFAULT_CONFIG_BY_TYPE[ProviderType.LOCAL],
      isActive: true,
      isDefault: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ResponsiveSheet.Content className="space-y-4 px-4 pb-4">
        <form.AppField name="name">
          {(field) => (
            <field.Input
              label="Name *"
              placeholder="primary-minio"
              description="Unique provider name within this organization."
            />
          )}
        </form.AppField>

        <form.AppField
          name="type"
          listeners={{
            onChange: ({ value }) => {
              if (isEdit) return;
              form.setFieldValue(
                "configJson",
                DEFAULT_CONFIG_BY_TYPE[value as ProviderType] ?? "{}",
              );
            },
          }}
        >
          {(field) => (
            <field.Select
              label="Type *"
              options={Object.values(ProviderType).map((value) => ({
                value,
                label: ProviderTypeLabels[value],
              }))}
              description="Storage backend (local disk, MinIO, or S3)."
            />
          )}
        </form.AppField>

        <form.AppField name="configJson">
          {(field) => (
            <field.Textarea
              label="Config (JSON) *"
              rows={10}
              className="font-mono text-xs"
              description="Provider connection settings as a JSON object."
            />
          )}
        </form.AppField>

        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <form.AppField name="isActive">
            {(field) => (
              <field.Checkbox label="Active — available for uploads" />
            )}
          </form.AppField>
          <form.AppField name="isDefault">
            {(field) => (
              <field.Checkbox label="Default provider for this organization" />
            )}
          </form.AppField>
        </div>
      </ResponsiveSheet.Content>

      <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
        >
          {([canSubmit, isFormSubmitting, isValidating]) => (
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !canSubmit ||
                isFormSubmitting ||
                isValidating
              }
            >
              {isSubmitting || isFormSubmitting ? "Saving…" : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveSheet.Footer>
    </form>
  );
}
