"use client";

import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import { organizationFormSchema } from "@workspace/validation";
import { useRef, useState } from "react";
import type {
  OrganizationRow,
  UpsertOrganizationInput,
} from "../hooks/use-orgs-queries";
import { slugifyOrgName } from "../lib/slugify";

export function OrganizationForm({
  formId = "organization-form",
  initialValues,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
  mode = "create",
  /** When true, use ResponsiveSheet Content/Footer (create sheet). */
  inSheet = false,
  /** `wide` uses a multi-column grid on md+ screens (settings). */
  layout = "stack",
  /** Hide helper copy / optional branding (create-org page). */
  minimal = false,
}: {
  formId?: string;
  initialValues?: Partial<OrganizationRow>;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: UpsertOrganizationInput) => void;
  onCancel?: () => void;
  mode?: "create" | "edit";
  inSheet?: boolean;
  layout?: "stack" | "wide";
  minimal?: boolean;
}) {
  const isEdit = mode === "edit" || Boolean(initialValues?.id);
  const isWide = layout === "wide" && !inSheet;
  const slugTouchedRef = useRef(Boolean(initialValues?.slug));
  const syncingSlugRef = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(isEdit && !minimal);

  const form = useAppForm({
    defaultValues: {
      name: initialValues?.name ?? "",
      slug: initialValues?.slug ?? "",
      supportEmail: initialValues?.supportEmail ?? "",
      logoUrl: initialValues?.logoUrl ?? "",
      appBaseUrl: initialValues?.appBaseUrl ?? "",
      customDomain: initialValues?.customDomain ?? "",
      primaryColor: initialValues?.primaryColor ?? "",
      secondaryColor: initialValues?.secondaryColor ?? "",
      privacyUrl: initialValues?.privacyUrl ?? "",
      termsUrl: initialValues?.termsUrl ?? "",
      externalRef: initialValues?.externalRef ?? "",
    },
    validators: { onChange: organizationFormSchema },
    onSubmit: async ({ value }) => {
      onSubmit({
        slug: value.slug.trim(),
        name: value.name.trim(),
        supportEmail: value.supportEmail?.trim() || null,
        logoUrl: value.logoUrl?.trim() || null,
        appBaseUrl: value.appBaseUrl?.trim() || null,
        customDomain: value.customDomain?.trim() || null,
        primaryColor: value.primaryColor?.trim() || null,
        secondaryColor: value.secondaryColor?.trim() || null,
        privacyUrl: value.privacyUrl?.trim() || null,
        termsUrl: value.termsUrl?.trim() || null,
        externalRef: value.externalRef?.trim() || null,
      });
    },
  });

  const identityFields = (
    <>
      <form.AppField
        name="name"
        listeners={{
          onChange: ({ value }) => {
            if (slugTouchedRef.current) return;
            syncingSlugRef.current = true;
            form.setFieldValue("slug", slugifyOrgName(String(value ?? "")));
            queueMicrotask(() => {
              syncingSlugRef.current = false;
            });
          },
        }}
      >
        {(field) => (
          <field.Input
            label={minimal ? "Name" : "Organization name *"}
            placeholder="Acme"
            autoFocus={!isEdit}
            description={
              minimal
                ? undefined
                : "Display name shown in the admin switcher and branding."
            }
          />
        )}
      </form.AppField>

      <form.AppField
        name="slug"
        listeners={{
          onChange: () => {
            if (!syncingSlugRef.current) slugTouchedRef.current = true;
          },
        }}
      >
        {(field) => (
          <field.Input
            label={minimal ? "Slug" : "Slug *"}
            placeholder="acme"
            description={
              minimal
                ? undefined
                : "Used in admin URLs and as orgSlug in send APIs."
            }
          />
        )}
      </form.AppField>
    </>
  );

  const optionalToggle =
    !isEdit && !isWide && !minimal ? (
      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide optional fields" : "Optional branding & URLs"}
      </button>
    ) : null;

  const brandingFields = (
    <>
      <form.AppField name="supportEmail">
        {(field) => <field.Input label="Support email" type="email" />}
      </form.AppField>
      <form.AppField name="logoUrl">
        {(field) => <field.Input label="Logo URL" />}
      </form.AppField>
      {(isEdit || isWide) && (
        <>
          <form.AppField name="appBaseUrl">
            {(field) => <field.Input label="App base URL" />}
          </form.AppField>
          <form.AppField name="customDomain">
            {(field) => <field.Input label="Custom domain" />}
          </form.AppField>
          <form.AppField name="primaryColor">
            {(field) => <field.Input label="Primary color" />}
          </form.AppField>
          <form.AppField name="secondaryColor">
            {(field) => <field.Input label="Secondary color" />}
          </form.AppField>
          <form.AppField name="privacyUrl">
            {(field) => <field.Input label="Privacy URL" />}
          </form.AppField>
          <form.AppField name="termsUrl">
            {(field) => <field.Input label="Terms URL" />}
          </form.AppField>
          <form.AppField name="externalRef">
            {(field) => <field.Input label="External ref" />}
          </form.AppField>
        </>
      )}
    </>
  );

  const fields = isWide ? (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Identity</h3>
          <p className="text-xs text-muted-foreground">
            Core name and URL slug for this organization.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">{identityFields}</div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Branding & links</h3>
          <p className="text-xs text-muted-foreground">
            Optional. Apps can also pass branding in API requests.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brandingFields}
        </div>
      </section>
    </div>
  ) : (
    <div className="space-y-4">
      {identityFields}
      {optionalToggle}
      {(showAdvanced || isEdit) && (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">
            All optional. Apps can pass branding in API requests instead.
          </p>
          {brandingFields}
        </div>
      )}
    </div>
  );

  const actions = (
    <>
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
              isSubmitting || !canSubmit || isFormSubmitting || isValidating
            }
          >
            {isSubmitting || isFormSubmitting ? "Saving…" : submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </>
  );

  if (inSheet) {
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
          {fields}
        </ResponsiveSheet.Content>
        <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
          {actions}
        </ResponsiveSheet.Footer>
      </form>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      {fields}
      <div
        className={
          isWide ? "flex justify-end gap-2 border-t pt-4" : "flex justify-end gap-2 pt-2"
        }
      >
        {actions}
      </div>
    </form>
  );
}
