"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useActiveOrg } from "@/provider/org-provider";
import {
  checkOrganizationSlugAvailable,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
} from "@/features/orgs/hooks/use-orgs-queries";
import { slugifyOrgName } from "@/features/orgs/lib/slugify";
import {
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Spinner,
  useAppForm,
} from "@workspace/ui/components";
import { Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .min(1, "Organization name is required")
  .max(255, "Organization name must not exceed 255 characters")
  .trim();

const DUPLICATE_NAME_MESSAGE =
  "An organization with this name already exists. Try a different name.";

function isDuplicateOrgError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("organizations_slug_unique") ||
    lower.includes("duplicate key") ||
    lower.includes("not available")
  );
}

/** Mirrors Parslinks dashboard first-organization / new-team onboarding. */
export function CreateOrganizationView() {
  const router = useRouter();
  const { setSelectedOrgSlug } = useActiveOrg();
  const { data, isLoading } = useOrganizationsQuery();
  const createMutation = useCreateOrganizationMutation();
  const hasOrgs = (data?.items?.length ?? 0) > 0;

  const form = useAppForm({
    defaultValues: { organizationName: "" },
    onSubmit: async ({ value }) => {
      const name = value.organizationName.trim();
      const slug = slugifyOrgName(name);

      try {
        const available = await checkOrganizationSlugAvailable(slug);
        if (!available) {
          form.setFieldMeta("organizationName", (prev) => ({
            ...prev,
            errorMap: {
              ...prev.errorMap,
              onSubmit: DUPLICATE_NAME_MESSAGE,
            },
          }));
          toast.error(DUPLICATE_NAME_MESSAGE);
          return;
        }
      } catch {
        // Fall through — create will surface a clear API error if needed.
      }

      createMutation.mutate(
        { name, slug, status: "active" },
        {
          onSuccess: (org) => {
            setSelectedOrgSlug(org.slug);
            toast.success("Organization created successfully", {
              description: "You can now start using your organization.",
            });
            router.replace(PAGE_ROUTES.home(org.slug));
          },
          onError: (err) => {
            const message = extractApiErrorMessage(
              err,
              "Failed to create organization",
            );
            if (isDuplicateOrgError(message)) {
              form.setFieldMeta("organizationName", (prev) => ({
                ...prev,
                errorMap: {
                  ...prev.errorMap,
                  onSubmit: DUPLICATE_NAME_MESSAGE,
                },
              }));
              toast.error(DUPLICATE_NAME_MESSAGE);
              return;
            }
            toast.error(message);
          },
        },
      );
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center">
        <h1 className="mb-2 text-2xl font-bold">Welcome!</h1>
        <p className="mb-6 text-muted-foreground">
          Create an organization or team to get started
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-4"
        >
          <form.AppField
            name="organizationName"
            validators={{
              onChange: NAME_SCHEMA,
              onChangeAsyncDebounceMs: 450,
              onChangeAsync: async ({ value }) => {
                const name = String(value ?? "").trim();
                if (!name) return undefined;
                const parsed = NAME_SCHEMA.safeParse(name);
                if (!parsed.success) return undefined;
                const slug = slugifyOrgName(parsed.data);
                try {
                  const available = await checkOrganizationSlugAvailable(slug);
                  if (!available) return DUPLICATE_NAME_MESSAGE;
                } catch {
                  return undefined;
                }
                return undefined;
              },
            }}
          >
            {(field) => {
              const raw = String(field.state.value ?? "").trim();
              const slug = raw ? slugifyOrgName(raw) : "";
              const checking = field.state.meta.isValidating;

              return (
                <field.Input
                  label={
                    <span className="inline-flex items-center gap-1">
                      Organization name
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex text-muted-foreground"
                            aria-label="About organization name"
                            onClick={(e) => e.preventDefault()}
                          >
                            <Info className="size-4" />
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent>
                          This will be your workspace where you can manage files,
                          storage providers, and API tokens. The URL slug is
                          generated from the name.
                        </HoverCardContent>
                      </HoverCard>
                    </span>
                  }
                  placeholder="Acme Corp, My Startup, John's Projects..."
                  className="placeholder:text-muted-foreground/50"
                  description={
                    checking
                      ? "Checking availability…"
                      : slug
                        ? `Slug: ${slug}`
                        : undefined
                  }
                  endAdornment={
                    checking ? (
                      <Loader2
                        className="size-4 animate-spin text-muted-foreground"
                        aria-label="Checking name"
                      />
                    ) : undefined
                  }
                  autoFocus
                />
              );
            }}
          </form.AppField>

          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
          >
            {([canSubmit, isFormSubmitting, isValidating]) => {
              const pending =
                createMutation.isPending || isFormSubmitting || isValidating;
              return (
                <Button
                  className="mt-2 w-full text-base"
                  type="submit"
                  disabled={!canSubmit || pending}
                >
                  {pending ? (
                    <span className="flex items-center gap-2">
                      <Spinner variant="bars" />
                      <span>Creating organization...</span>
                    </span>
                  ) : (
                    "Create Organization"
                  )}
                </Button>
              );
            }}
          </form.Subscribe>

          {hasOrgs ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push(PAGE_ROUTES.ORGS)}
            >
              Cancel
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
