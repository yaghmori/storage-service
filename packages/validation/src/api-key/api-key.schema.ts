import { z } from "zod";

const optionalPositiveIntString = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") return true;
      const n = Number(value);
      return (
        typeof n === "number" &&
        !isNaN(n) &&
        Math.abs(n) !== Infinity &&
        n > 0 &&
        Math.floor(n) === n
      );
    },
    { message: "Must be a positive whole number" },
  );

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
  /** Empty = inherit org / platform RATE_LIMIT_MAX. */
  rateLimitMax: optionalPositiveIntString,
  /** Empty = inherit org / platform RATE_LIMIT_TTL_MS. */
  rateLimitTtlMs: optionalPositiveIntString,
  /** When true, stores permissions.rateLimitExempt. */
  rateLimitExempt: z.boolean(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/** Build api_keys.permissions from create-form rate-limit fields. */
export function buildApiKeyPermissions(input: {
  rateLimitMax?: string;
  rateLimitTtlMs?: string;
  rateLimitExempt?: boolean;
}): Record<string, unknown> | undefined {
  const permissions: Record<string, unknown> = {};
  const maxRaw = input.rateLimitMax?.trim() ?? "";
  const ttlRaw = input.rateLimitTtlMs?.trim() ?? "";
  if (maxRaw) {
    const n = Number(maxRaw);
    if (typeof n === "number" && !isNaN(n) && Math.abs(n) !== Infinity && n > 0) {
      permissions.rateLimitMax = Math.floor(n);
    }
  }
  if (ttlRaw) {
    const n = Number(ttlRaw);
    if (typeof n === "number" && !isNaN(n) && Math.abs(n) !== Infinity && n > 0) {
      permissions.rateLimitTtlMs = Math.floor(n);
    }
  }
  if (input.rateLimitExempt === true) {
    permissions.rateLimitExempt = true;
  }
  return Object.keys(permissions).length > 0 ? permissions : undefined;
}
