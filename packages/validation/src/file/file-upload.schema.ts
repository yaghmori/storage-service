import { z } from "zod";

const optionalStorageKeySchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (value.indexOf("..") === -1 &&
        value.indexOf("\\") === -1 &&
        /^[a-zA-Z0-9_./-]+$/.test(value)),
    { message: "Use a relative path with letters, numbers, _ . / - only" },
  );

export const fileUploadFormSchema = z.object({
  file: z
    .custom<File | null>((value) => typeof File !== "undefined" && value instanceof File, {
      message: "File is required",
    })
    .refine((value): value is File => value instanceof File, {
      message: "File is required",
    }),
  storageProviderId: z.string().trim().min(1, "Provider is required"),
  storageKey: optionalStorageKeySchema,
});

export type FileUploadFormInput = z.infer<typeof fileUploadFormSchema>;
