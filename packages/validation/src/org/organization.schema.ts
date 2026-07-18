import { z } from "zod";
import {
  optionalEmailSchema,
  optionalHexColorSchema,
  optionalUrlSchema,
  orgSlugSchema,
} from "../common/validators";

export const organizationFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must not exceed 255 characters")
    .trim(),
  slug: orgSlugSchema,
  supportEmail: optionalEmailSchema,
  logoUrl: optionalUrlSchema,
  appBaseUrl: optionalUrlSchema,
  customDomain: z.string().trim(),
  primaryColor: optionalHexColorSchema,
  secondaryColor: optionalHexColorSchema,
  privacyUrl: optionalUrlSchema,
  termsUrl: optionalUrlSchema,
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
