"use client";

import { Button, ResponsiveSheet, useAppForm } from "@workspace/ui/components";
import { organizationFormSchema } from "@workspace/validation";
import { useRef } from "react";
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
  /** Hide helper copy (create-org page). */
  minimal = false,
  /** Omit inline save/cancel; use an external submit button with `form={formId}`. */
  hideActions = false,
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
  hideActions?: boolean;
}) {
  const isEdit = mode === "edit" || Boolean(initialValues?.id);
  const isWide = layout === "wide" && !inSheet;
  const slugTouchedRef = useRef(Boolean(initialValues?.slug));
  const syncingSlugRef = useRef(false);

  const form = useAppForm({
    defaultValues: {
      name: initialValues?.name ?? "",
      slug: initialValues?.slug ?? "",
      externalRef: initialValues?.externalRef ?? "",
    },
    validators: { onChange: organizationFormSchema },
    onSubmit: async ({ value }) => {
      onSubmit({
        slug: value.slug.trim(),
        name: value.name.trim(),
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
                : "Display name shown in the admin organization switcher."
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
                : "Used in admin URLs and as the org identifier in APIs."
            }
          />
        )}
      </form.AppField>

      {!minimal && (
        <form.AppField name="externalRef">
          {(field) => (
            <field.Input
              label="External ref"
              placeholder="eallyfe-prod"
              description="Optional mapping key to an external product or tenant id."
            />
          )}
        </form.AppField>
      )}
    </>
  );

  const fields = isWide ? (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Identity</h3>
        <p className="text-xs text-muted-foreground">
          Core name, URL slug, and optional external mapping for this
          organization.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{identityFields}</div>
    </div>
  ) : (
    <div className="space-y-4">{identityFields}</div>
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
      {!hideActions ? (
        <div
          className={
            isWide
              ? "flex justify-end gap-2 border-t pt-4"
              : "flex justify-end gap-2 pt-2"
          }
        >
          {actions}
        </div>
      ) : null}
    </form>
  );
}
