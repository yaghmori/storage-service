import { z } from "zod";
import { jsonObjectStringSchema } from "../common/validators";
import { ProviderType } from "../storage/enums";

export const providerFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  type: z.nativeEnum(ProviderType),
  configJson: jsonObjectStringSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
});

export type ProviderFormInput = z.infer<typeof providerFormSchema>;
