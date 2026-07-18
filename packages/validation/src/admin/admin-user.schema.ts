import { z } from "zod";
import { emailSchema, passwordSchema } from "../common/validators";

const adminRoleSchema = z.enum(["admin", "viewer"]);

export const createAdminUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: adminRoleSchema,
  isActive: z.boolean(),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const updateAdminUserSchema = z.object({
  email: emailSchema,
  /** Empty = keep existing password; otherwise must meet strength rules. */
  password: z.union([z.literal(""), passwordSchema]),
  role: adminRoleSchema,
  isActive: z.boolean(),
});

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
