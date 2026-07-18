"use client";

import { useProvidersQuery } from "@/features/providers/hooks/use-providers-queries";
import { useActiveOrg } from "@/provider/org-provider";
import { fileUploadFormSchema } from "@workspace/validation";
import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import { useEffect } from "react";
import type { UploadFileInput } from "../hooks/use-files-queries";

const DEFAULT_PROVIDER_VALUE = "__default__";

export function FileUploadForm({
  formId = "file-upload-form",
  isSubmitting,
  submitLabel = "Upload file",
  onSubmit,
  onCancel,
}: {
  formId?: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (payload: UploadFileInput) => void;
  onCancel?: () => void;
}) {
  const { activeOrg } = useActiveOrg();
  const { data: providersData } = useProvidersQuery(activeOrg?.id);
  const providers = (providersData?.items ?? []).filter((p) => p.isActive);

  const form = useAppForm({
    defaultValues: {
      file: null as File | null,
      storageProviderId: DEFAULT_PROVIDER_VALUE,
      storageKey: "",
    },
    validators: { onChange: fileUploadFormSchema },
    onSubmit: async ({ value }) => {
      if (!(value.file instanceof File)) return;
      const providerId =
        value.storageProviderId === DEFAULT_PROVIDER_VALUE
          ? undefined
          : value.storageProviderId.trim() || undefined;
      onSubmit({
        file: value.file,
        storageProviderId: providerId,
        storageKey: value.storageKey.trim() || undefined,
      });
    },
  });

  useEffect(() => {
    form.reset({
      file: null,
      storageProviderId: DEFAULT_PROVIDER_VALUE,
      storageKey: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerOptions = [
    { value: DEFAULT_PROVIDER_VALUE, label: "Default provider" },
    ...providers.map((p) => ({
      value: p.id,
      label: `${p.name}${p.isDefault ? " (default)" : ""} — ${p.type}`,
    })),
  ];

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
        <form.AppField name="file">
          {(field) => (
            <field.FileUploader
              label="File *"
              description="Select a file to store in this organization."
              displayPreview
              align="left"
            />
          )}
        </form.AppField>

        <form.AppField name="storageProviderId">
          {(field) => (
            <field.Select
              label="Storage provider"
              options={providerOptions}
              description="Leave as default to use the org’s default provider."
            />
          )}
        </form.AppField>

        <form.AppField name="storageKey">
          {(field) => (
            <field.Input
              label="Storage key (optional)"
              placeholder="path/to/object.bin"
              description="Optional stable object path. Leave blank to auto-generate."
            />
          )}
        </form.AppField>
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
              {isSubmitting || isFormSubmitting ? "Uploading…" : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveSheet.Footer>
    </form>
  );
}
