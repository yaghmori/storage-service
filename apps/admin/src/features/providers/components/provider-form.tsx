"use client";

import {
  ProviderType,
  ProviderTypeLabels,
  defaultProviderFormValues,
  formValuesToProviderConfig,
  providerConfigToFormParts,
  providerFormSchema,
  zodFlatFields,
  type ProviderFormValues,
} from "@workspace/validation";
import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import { useEffect, type ReactNode } from "react";
import type {
  ProviderRow,
  UpsertProviderInput,
} from "../hooks/use-providers-queries";

function buildDefaultValues(
  initialValues?: Partial<ProviderRow>,
): ProviderFormValues {
  const type = (initialValues?.type as ProviderType) ?? ProviderType.LOCAL;
  const parts = providerConfigToFormParts(
    type,
    (initialValues?.config as Record<string, unknown> | undefined) ?? undefined,
  );

  return {
    ...defaultProviderFormValues(type),
    name: initialValues?.name ?? "",
    type,
    isActive: initialValues?.isActive ?? true,
    isDefault: initialValues?.isDefault ?? false,
    ...parts,
  };
}

function InlineSection({
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className="space-y-4">{children}</div>;
}

export function ProviderForm({
  formId = "provider-form",
  initialValues,
  isSubmitting,
  isTesting,
  submitLabel,
  layout = "sheet",
  onSubmit,
  onCancel,
  onTest,
}: {
  formId?: string;
  initialValues?: Partial<ProviderRow>;
  isSubmitting?: boolean;
  isTesting?: boolean;
  submitLabel: string;
  /** "inline" drops the sheet chrome and footer so a host (wizard) owns the actions. */
  layout?: "sheet" | "inline";
  onSubmit: (payload: UpsertProviderInput) => void;
  onCancel?: () => void;
  onTest?: () => void;
}) {
  const isEdit = Boolean(initialValues?.id);
  const isInline = layout === "inline";
  const Section: (props: {
    className?: string;
    children: ReactNode;
  }) => ReactNode = isInline ? InlineSection : ResponsiveSheet.Content;

  const validate = ({ value }: { value: ProviderFormValues }) => {
    const result = providerFormSchema.safeParse(value);
    if (!result.success) return zodFlatFields(result.error);
    return undefined;
  };

  const form = useAppForm({
    defaultValues: buildDefaultValues(initialValues),
    validators: {
      onChange: validate,
      onSubmit: validate,
    },
    onSubmit: async ({ value }) => {
      onSubmit({
        name: value.name.trim(),
        type: value.type,
        config: formValuesToProviderConfig(value),
        isActive: value.isActive,
        isDefault: value.isDefault,
      });
    },
  });

  useEffect(() => {
    if (isEdit) return;
    form.reset(defaultProviderFormValues(ProviderType.LOCAL));
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
      className={isInline ? "flex flex-col" : "flex min-h-0 flex-1 flex-col"}
    >
      <Section className="space-y-4 px-4 pb-4">
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
              const next = value as ProviderType;
              const defaults = defaultProviderFormValues(next);
              form.setFieldValue("local", defaults.local);
              form.setFieldValue("minio", defaults.minio);
              form.setFieldValue("s3", defaults.s3);
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
              description={
                isEdit
                  ? "Type cannot be changed after create — create a new provider instead."
                  : "Storage backend (local disk, MinIO, or S3)."
              }
              disabled={isEdit}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) => (
            <div className="space-y-4 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">
                {ProviderTypeLabels[type as ProviderType]} settings
              </p>

              {type === ProviderType.LOCAL && (
                <>
                  <form.AppField name="local.path">
                    {(field) => (
                      <field.Input
                        label="Upload path *"
                        placeholder="/data/uploads"
                        description="Absolute or container path where files are stored."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="local.bucket">
                    {(field) => (
                      <field.Input
                        label="Logical bucket (optional)"
                        placeholder="local"
                        description="Optional namespace prefix for local keys."
                      />
                    )}
                  </form.AppField>
                </>
              )}

              {type === ProviderType.MINIO && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="minio.endpoint">
                      {(field) => (
                        <field.Input
                          label="API endpoint *"
                          placeholder="minio"
                          description="Host the API uses (Docker: minio)."
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="minio.port">
                      {(field) => (
                        <field.Input
                          type="number"
                          label="Port"
                          placeholder="9000"
                          description="MinIO API port (default 9000)."
                        />
                      )}
                    </form.AppField>
                  </div>

                  <form.AppField name="minio.browserEndpoint">
                    {(field) => (
                      <field.Input
                        label="Browser S3 endpoint (optional)"
                        placeholder=""
                        description="Leave empty for private MinIO. Set only if browsers can reach this MinIO over HTTPS (not cdn.allyfe.org)."
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="minio.bucket">
                    {(field) => (
                      <field.Input
                        label="Bucket *"
                        placeholder="storage"
                      />
                    )}
                  </form.AppField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="minio.accessKeyId">
                      {(field) => (
                        <field.Input
                          label="Access key *"
                          placeholder="minioadmin"
                          autoComplete="off"
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="minio.secretAccessKey">
                      {(field) => (
                        <field.Password
                          label="Secret key *"
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                      )}
                    </form.AppField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="minio.region">
                      {(field) => (
                        <field.Input
                          label="Region"
                          placeholder="us-east-1"
                          description="Required for offline signing (default us-east-1)."
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="minio.signedUrlExpiresIn">
                      {(field) => (
                        <field.Input
                          type="number"
                          label="Signed URL TTL (seconds)"
                          placeholder="3600"
                          description="60–604800. Empty = API default (1 hour)."
                        />
                      )}
                    </form.AppField>
                  </div>

                  <form.AppField name="minio.useSSL">
                    {(field) => (
                      <field.Checkbox label="Use SSL (HTTPS) for API endpoint" />
                    )}
                  </form.AppField>
                </>
              )}

              {type === ProviderType.S3 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="s3.bucket">
                      {(field) => (
                        <field.Input label="Bucket *" placeholder="my-bucket" />
                      )}
                    </form.AppField>
                    <form.AppField name="s3.region">
                      {(field) => (
                        <field.Input
                          label="Region *"
                          placeholder="us-east-1"
                        />
                      )}
                    </form.AppField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="s3.accessKeyId">
                      {(field) => (
                        <field.Input
                          label="Access key *"
                          autoComplete="off"
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="s3.secretAccessKey">
                      {(field) => (
                        <field.Password
                          label="Secret key *"
                          autoComplete="new-password"
                        />
                      )}
                    </form.AppField>
                  </div>

                  <form.AppField name="s3.endpoint">
                    {(field) => (
                      <field.Input
                        label="Custom endpoint (optional)"
                        placeholder="https://s3.amazonaws.com"
                        description="Leave empty for AWS. R2: https://<accountid>.r2.cloudflarestorage.com. Must be public HTTPS for browser presign."
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="s3.publicEndpoint">
                    {(field) => (
                      <field.Input
                        label="Public / CDN endpoint (optional)"
                        placeholder=""
                        description="Unused for app-signed delivery. Keep the bucket private; leave empty unless you serve unsigned objects from a custom domain."
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="s3.signedUrlExpiresIn">
                    {(field) => (
                      <field.Input
                        type="number"
                        label="Signed URL TTL (seconds)"
                        placeholder="3600"
                        description="60–604800. Empty = API default (1 hour)."
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="s3.forcePathStyle">
                    {(field) => (
                      <field.Checkbox label="Force path-style URLs (required by some S3-compatible stores)" />
                    )}
                  </form.AppField>
                </>
              )}
            </div>
          )}
        </form.Subscribe>

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
      </Section>

      {isInline ? null : (
      <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {isEdit && onTest ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || isTesting}
            onClick={onTest}
          >
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
        ) : null}
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
        >
          {([canSubmit, isFormSubmitting, isValidating]) => (
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                isTesting ||
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
      )}
    </form>
  );
}
