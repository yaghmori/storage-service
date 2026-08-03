import { z } from "zod";

export const createApiKeySchema = z.object({
  serviceName: z
    .string()
    .min(1, "Service name is required")
    .max(120, "Service name is too long")
    .trim(),
  /** ISO string from DateTimePicker, or empty when unset. */
  expiresAt: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value === "") return true;
        const t = Date.parse(value);
        return t === t;
      },
      { message: "Invalid expiration date" },
    ),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
