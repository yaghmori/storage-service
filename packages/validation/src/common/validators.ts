import { z } from "zod";

/** Required email — same rules as eAllyfe. */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .toLowerCase()
  .trim();

/** Empty string or valid email. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Invalid email format",
  });

/** Strong password — same rules as eAllyfe. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^a-zA-Z0-9]/,
    "Password must contain at least one special character",
  );

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must not exceed 50 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens",
  )
  .trim();

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must not exceed 100 characters")
  .trim();

/** Empty string or absolute http(s) URL. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || z.string().url().safeParse(v).success,
    { message: "Invalid URL" },
  );

/** Empty string or #RGB / #RRGGBB / #RRGGBBAA. */
export const optionalHexColorSchema = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" ||
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(v),
    { message: "Use a hex color like #RRGGBB" },
  );

export const orgSlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(60, "Slug must not exceed 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens",
  )
  .trim();

export const templateKeySchema = z
  .string()
  .min(1, "Template key is required")
  .max(100, "Template key must not exceed 100 characters")
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    "Use lowercase letters, numbers, hyphens, or underscores",
  )
  .trim();

export const jsonObjectStringSchema = z
  .string()
  .min(2, "Config JSON is required")
  .refine(
    (value) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        return (
          parsed !== null &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        );
      } catch {
        return false;
      }
    },
    { message: "Config must be a valid JSON object" },
  );

/**
 * Flatten a Zod failure into TanStack Form `{ fields }` shape
 * (eAllyfe Pattern B).
 */
export function zodFlatFields(
  error: z.ZodError,
): { fields: Record<string, string> } {
  const issues = error.flatten();
  const fields: Record<string, string> = {};
  for (const key of Object.keys(issues.fieldErrors)) {
    const messages = issues.fieldErrors[key as keyof typeof issues.fieldErrors];
    fields[key] = Array.isArray(messages)
      ? (messages[0] ?? "Invalid")
      : String(messages ?? "Invalid");
  }
  return { fields };
}
