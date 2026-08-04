import { z } from "zod";
import { orgSlugSchema } from "../common/validators";

export const organizationFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must not exceed 255 characters")
    .trim(),
  slug: orgSlugSchema,
  externalRef: z.string().trim().max(255, "External ref is too long"),
});

export type OrganizationFormInput = z.infer<typeof organizationFormSchema>;

export const organizationOnboardingSchema = z.object({
  organizationName: z
    .string()
    .min(1, "Organization name is required")
    .max(255, "Organization name must not exceed 255 characters")
    .trim(),
  slug: orgSlugSchema,
});

export type OrganizationOnboardingInput = z.infer<
  typeof organizationOnboardingSchema
>;

export const orgLimitsFormSchema = z.object({
  maxFileSizeBytes: z
    .union([z.number().int().positive(), z.null()])
    .optional(),
  allowedMimeTypesText: z.string().optional(),
  storageQuotaBytes: z
    .union([z.number().int().positive(), z.null()])
    .optional(),
  maxObjectCount: z.union([z.number().int().positive(), z.null()]).optional(),
});

export type OrgLimitsFormInput = z.infer<typeof orgLimitsFormSchema>;

export const orgRetentionFormSchema = z.object({
  softDeleteRetentionDays: z
    .number({ error: "Retention days must be a number" })
    .int("Retention days must be a whole number")
    .min(1, "Retention must be at least 1 day")
    .max(3650, "Retention must not exceed 3650 days"),
});

export type OrgRetentionFormInput = z.infer<typeof orgRetentionFormSchema>;
