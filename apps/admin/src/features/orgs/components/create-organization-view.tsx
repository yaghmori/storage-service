"use client";

import { CrosshairFrame } from "@/components/layout/crosshair-frame";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { invalidateOrgs, invalidateProviders } from "@/lib/query-keys";
import { useAuth } from "@/provider/auth-provider";
import { useActiveOrg } from "@/provider/org-provider";
import {
  checkOrganizationSlugAvailable,
  updateOrgLimits,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
} from "@/features/orgs/hooks/use-orgs-queries";
import { slugifyOrgName } from "@/features/orgs/lib/slugify";
import { ProviderForm } from "@/features/providers/components/provider-form";
import {
  createProviderForOrg,
  type UpsertProviderInput,
} from "@/features/providers/hooks/use-providers-queries";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Spinner,
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
  useAppForm,
} from "@workspace/ui/components";
import { Card, CardContent } from "@workspace/ui/components/card";
import { CheckIcon, Info, Loader2, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CreateOrgQuotaStep,
  EMPTY_QUOTA_STEP,
  quotaStepToLimits,
  type QuotaStepValue,
} from "./create-org-quota-step";

const NAME_SCHEMA = z
  .string()
  .min(1, "Organization name is required")
  .max(255, "Organization name must not exceed 255 characters")
  .trim();

const DUPLICATE_NAME_MESSAGE =
  "An organization with this name already exists. Try a different name.";

const NAME_FORM_ID = "create-org-name-form";
const PROVIDER_FORM_ID = "create-org-provider-form";

const STEPS = [
  { title: "Organization", description: "Name and workspace" },
  { title: "Storage limits", description: "Optional quota" },
  { title: "Storage provider", description: "Optional backend" },
];

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setSelectedOrgSlug } = useActiveOrg();
  const { data, isLoading } = useOrganizationsQuery();
  const createMutation = useCreateOrganizationMutation();
  const orgs = data?.items ?? [];
  const hasOrgs = orgs.length > 0;
  // Platform super-admin (users.role), not org membership role.
  const isPlatformAdmin = user?.role === "admin";

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [quota, setQuota] = useState<QuotaStepValue>(EMPTY_QUOTA_STEP);
  const [isCreating, setIsCreating] = useState(false);

  const goToStep = (next: number) => {
    setStep(next);
    setMaxStepReached((prev) => Math.max(prev, next));
  };

  // Invited org members cannot create orgs — send them back to their workspace.
  // Platform admins may create additional organizations.
  useEffect(() => {
    if (isLoading || !hasOrgs || isPlatformAdmin) return;
    const first = orgs[0];
    if (!first) return;
    setSelectedOrgSlug(first.slug);
    router.replace(PAGE_ROUTES.home(first.slug));
  }, [hasOrgs, isLoading, isPlatformAdmin, orgs, router, setSelectedOrgSlug]);

  const form = useAppForm({
    defaultValues: { organizationName: "" },
    onSubmit: async ({ value }) => {
      const name = value.organizationName.trim();
      const slug = slugifyOrgName(name);

      try {
        const available = await checkOrganizationSlugAvailable(slug);
        if (!available) {
          markNameTaken();
          return;
        }
      } catch {
        // Fall through — create will surface a clear API error if needed.
      }

      goToStep(2);
    },
  });

  function markNameTaken() {
    form.setFieldMeta("organizationName", (prev) => ({
      ...prev,
      errorMap: { ...prev.errorMap, onSubmit: DUPLICATE_NAME_MESSAGE },
    }));
    toast.error(DUPLICATE_NAME_MESSAGE);
    setStep(1);
  }

  /**
   * The org must exist before limits and providers can be attached, so the
   * optional steps are applied after creation. A failure there is reported but
   * never discards the organization.
   */
  async function createOrganization(provider?: UpsertProviderInput) {
    if (isCreating) return;

    const name = String(form.state.values.organizationName ?? "").trim();
    if (!NAME_SCHEMA.safeParse(name).success) {
      setStep(1);
      toast.error("Organization name is required");
      return;
    }
    const slug = slugifyOrgName(name);

    setIsCreating(true);
    try {
      try {
        const available = await checkOrganizationSlugAvailable(slug);
        if (!available) {
          markNameTaken();
          return;
        }
      } catch {
        // Fall through — create will surface a clear API error if needed.
      }

      const org = await createMutation.mutateAsync({
        name,
        slug,
        status: "active",
      });

      const warnings: string[] = [];

      const limits = quotaStepToLimits(quota);
      if (limits) {
        try {
          await updateOrgLimits(org.id, limits);
        } catch (err) {
          warnings.push(
            `Storage limits were not saved: ${extractApiErrorMessage(err, "unknown error")}`,
          );
        }
      }

      if (provider) {
        try {
          await createProviderForOrg(org.id, provider);
        } catch (err) {
          warnings.push(
            `Storage provider was not created: ${extractApiErrorMessage(err, "unknown error")}`,
          );
        }
      }

      invalidateOrgs(queryClient, { orgId: org.id, limits: true, usage: true });
      invalidateProviders(queryClient);
      setSelectedOrgSlug(org.slug);

      if (warnings.length > 0) {
        toast.warning("Organization created with warnings", {
          description: `${warnings.join(" ")} You can finish setup in organization settings.`,
        });
      } else {
        toast.success("Organization created successfully", {
          description: "You can now start using your organization.",
        });
      }

      router.replace(PAGE_ROUTES.home(org.slug));
    } catch (err) {
      const message = extractApiErrorMessage(
        err,
        "Failed to create organization",
      );
      if (isDuplicateOrgError(message)) {
        markNameTaken();
        return;
      }
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading || (hasOrgs && !isPlatformAdmin)) {
    return (
      <div className="flex justify-center items-center text-sm min-h-svh text-muted-foreground">
        {hasOrgs && !isPlatformAdmin ? "Redirecting…" : "Loading…"}
      </div>
    );
  }

  const cancelButton =
    hasOrgs && isPlatformAdmin ? (
      <Button
        type="button"
        variant="ghost"
        disabled={isCreating}
        onClick={() => {
          const first = orgs[0];
          if (first) {
            setSelectedOrgSlug(first.slug);
            router.push(PAGE_ROUTES.home(first.slug));
          } else {
            router.back();
          }
        }}
      >
        Cancel
      </Button>
    ) : null;

  return (
    <div className="flex overflow-hidden relative flex-col justify-center items-center px-4 py-12 min-h-svh bg-background">
      <Stepper
        value={step}
        onValueChange={setStep}
        indicators={{
          completed: <CheckIcon className="size-3.5" />,
          loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
        }}
        className="space-y-8 w-full max-w-2xl"
      >
        <div className="px-4 py-2 sm:px-8">
          <h1 className="mb-2 text-2xl font-bold">
            {hasOrgs ? "Create organization" : "Welcome!"}
          </h1>
          <p className="text-muted-foreground">
            {hasOrgs
              ? "Create another organization workspace"
              : "Create an organization or team to get started"}
          </p>
        </div>

        <CrosshairFrame innerClassName="space-y-6 p-4 sm:p-8">
          <StepperNav>
            {STEPS.map((item, index) => (
              <StepperItem
                key={item.title}
                step={index + 1}
                disabled={index + 1 > maxStepReached || isCreating}
                loading={isCreating && index + 1 === step}
                className="relative"
              >
                <StepperTrigger className="flex gap-1.5 justify-start">
                  <StepperIndicator>{index + 1}</StepperIndicator>
                  <div className="flex flex-col gap-0.5 items-start">
                    <StepperTitle>{item.title}</StepperTitle>
                    <StepperDescription className="hidden sm:block">
                      {item.description}
                    </StepperDescription>
                  </div>
                </StepperTrigger>

                {STEPS.length > index + 1 && (
                  <StepperSeparator className="md:mx-2.5" />
                )}
              </StepperItem>
            ))}
          </StepperNav>

          <Card className="w-full">
            <CardContent className="text-sm">
              <StepperPanel className="text-sm">
                <StepperContent value={1}>
                  <form
                    id={NAME_FORM_ID}
                    onSubmit={(e) => {
                      e.preventDefault();
                      form.handleSubmit();
                    }}
                    className="flex flex-col gap-4"
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
                            const available =
                              await checkOrganizationSlugAvailable(slug);
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
                              <span className="inline-flex gap-1 items-center">
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
                                    This will be your workspace where you can
                                    manage files, storage providers, and API
                                    keys. The URL slug is generated from the
                                    name.
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
                                  className="animate-spin size-4 text-muted-foreground"
                                  aria-label="Checking name"
                                />
                              ) : undefined
                            }
                            autoFocus
                          />
                        );
                      }}
                    </form.AppField>
                  </form>
                </StepperContent>

                <StepperContent value={2}>
                  <CreateOrgQuotaStep value={quota} onChange={setQuota} />
                </StepperContent>

                <StepperContent value={3} forceMount>
                  <div className="flex flex-col gap-6">
                    <p className="text-muted-foreground">
                      Connect a storage backend now, or skip and add one later
                      from the providers page.
                    </p>

                    <ProviderForm
                      formId={PROVIDER_FORM_ID}
                      layout="inline"
                      submitLabel="Create organization"
                      isSubmitting={isCreating}
                      onSubmit={(payload) => {
                        void createOrganization(payload);
                      }}
                    />
                  </div>
                </StepperContent>
              </StepperPanel>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end items-center">
            {step === 1 ? (
              <>
                {cancelButton}
                <form.Subscribe
                  selector={(s) => [
                    s.canSubmit,
                    s.isSubmitting,
                    s.isValidating,
                  ]}
                >
                  {([canSubmit, isFormSubmitting, isValidating]) => (
                    <Button
                      type="submit"
                      form={NAME_FORM_ID}
                      disabled={!canSubmit || isFormSubmitting || isValidating}
                    >
                      {isFormSubmitting || isValidating
                        ? "Checking…"
                        : "Continue"}
                    </Button>
                  )}
                </form.Subscribe>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isCreating}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={isCreating}
                  onClick={() => goToStep(3)}
                >
                  Continue
                </Button>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isCreating}
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  onClick={() => {
                    void createOrganization();
                  }}
                >
                  Skip and create
                </Button>
                <Button
                  type="submit"
                  form={PROVIDER_FORM_ID}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <span className="flex gap-2 items-center">
                      <Spinner variant="bars" />
                      <span>Creating…</span>
                    </span>
                  ) : (
                    "Create with provider"
                  )}
                </Button>
              </>
            ) : null}
          </div>
        </CrosshairFrame>
      </Stepper>
    </div>
  );
}
