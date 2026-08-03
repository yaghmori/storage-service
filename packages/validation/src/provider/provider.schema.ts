import { z } from "zod";
import { ProviderType } from "../storage/enums";

/** Empty → undefined; otherwise positive int in [min, max]. */
const optionalExpiresInSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .number()
    .int("Must be a whole number")
    .min(60, "Minimum 60 seconds")
    .max(604_800, "Maximum 7 days (604800 seconds)")
    .optional(),
);

const optionalPortSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .number()
    .int("Port must be a whole number")
    .min(1, "Invalid port")
    .max(65535, "Invalid port")
    .optional(),
);

/** Trim; empty string allowed (optional field). */
const optionalTrimmed = z.string().trim();

export const localProviderConfigSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, "Upload path is required")
    .max(500, "Path is too long"),
  bucket: optionalTrimmed.max(100).optional().or(z.literal("")),
});

export const minioProviderConfigSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .min(1, "Endpoint is required")
    .max(255, "Endpoint is too long"),
  port: optionalPortSchema,
  publicEndpoint: optionalTrimmed
    .refine(
      (v) =>
        v === "" ||
        /^https?:\/\//i.test(v) ||
        /^[a-z0-9.-]+(?::\d+)?$/i.test(v),
      {
        message:
          "Use a host (localhost:9000) or URL (http://localhost:9000 / https://cdn.example.com)",
      },
    )
    .optional()
    .or(z.literal("")),
  bucket: z
    .string()
    .trim()
    .min(1, "Bucket is required")
    .max(100, "Bucket is too long"),
  accessKeyId: z
    .string()
    .trim()
    .min(1, "Access key is required")
    .max(255),
  secretAccessKey: z
    .string()
    .min(1, "Secret key is required")
    .max(255),
  useSSL: z.boolean(),
  region: optionalTrimmed.max(64).optional().or(z.literal("")),
  signedUrlExpiresIn: optionalExpiresInSchema,
});

export const s3ProviderConfigSchema = z.object({
  bucket: z
    .string()
    .trim()
    .min(1, "Bucket is required")
    .max(100, "Bucket is too long"),
  region: z
    .string()
    .trim()
    .min(1, "Region is required")
    .max(64, "Region is too long"),
  accessKeyId: z
    .string()
    .trim()
    .min(1, "Access key is required")
    .max(255),
  secretAccessKey: z
    .string()
    .min(1, "Secret key is required")
    .max(255),
  endpoint: optionalTrimmed.max(255).optional().or(z.literal("")),
  publicEndpoint: optionalTrimmed
    .refine(
      (v) =>
        v === "" ||
        /^https?:\/\//i.test(v) ||
        /^[a-z0-9.-]+(?::\d+)?$/i.test(v),
      {
        message:
          "Use a host or URL (https://cdn.example.com or s3.amazonaws.com)",
      },
    )
    .optional()
    .or(z.literal("")),
  forcePathStyle: z.boolean(),
  signedUrlExpiresIn: optionalExpiresInSchema,
});

export type LocalProviderConfigInput = z.infer<typeof localProviderConfigSchema>;
export type MinioProviderConfigInput = z.infer<typeof minioProviderConfigSchema>;
export type S3ProviderConfigInput = z.infer<typeof s3ProviderConfigSchema>;

export const DEFAULT_LOCAL_PROVIDER_CONFIG: LocalProviderConfigInput = {
  path: "/tmp/storage-uploads",
  bucket: "",
};

export const DEFAULT_MINIO_PROVIDER_CONFIG: MinioProviderConfigInput = {
  endpoint: "minio",
  port: 9000,
  publicEndpoint: "http://localhost:9000",
  bucket: "storage",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  useSSL: false,
  region: "us-east-1",
  signedUrlExpiresIn: undefined,
};

export const DEFAULT_S3_PROVIDER_CONFIG: S3ProviderConfigInput = {
  bucket: "",
  region: "us-east-1",
  accessKeyId: "",
  secretAccessKey: "",
  endpoint: "",
  publicEndpoint: "",
  forcePathStyle: false,
  signedUrlExpiresIn: undefined,
};

export type ProviderFormValues = {
  name: string;
  type: ProviderType;
  isActive: boolean;
  isDefault: boolean;
  local: LocalProviderConfigInput;
  minio: MinioProviderConfigInput;
  s3: S3ProviderConfigInput;
};

export const providerFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must not exceed 100 characters")
      .trim(),
    type: z.nativeEnum(ProviderType),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    // Kept loose here; active type is validated in superRefine.
    local: z.custom<LocalProviderConfigInput>(),
    minio: z.custom<MinioProviderConfigInput>(),
    s3: z.custom<S3ProviderConfigInput>(),
  })
  .superRefine((value, ctx) => {
    const active =
      value.type === ProviderType.LOCAL
        ? {
            key: "local" as const,
            schema: localProviderConfigSchema,
            data: value.local,
          }
        : value.type === ProviderType.MINIO
          ? {
              key: "minio" as const,
              schema: minioProviderConfigSchema,
              data: value.minio,
            }
          : {
              key: "s3" as const,
              schema: s3ProviderConfigSchema,
              data: value.s3,
            };

    const parsed = active.schema.safeParse(active.data);
    if (parsed.success) return;

    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: [active.key, ...issue.path],
      });
    }
  });

export type ProviderFormInput = z.infer<typeof providerFormSchema>;

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return typeof n === "number" && !isNaN(n) && Math.abs(n) !== Infinity
    ? n
    : undefined;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Hydrate form defaults from a stored provider row config. */
export function providerConfigToFormParts(
  type: ProviderType,
  config: Record<string, unknown> | null | undefined,
): Pick<ProviderFormValues, "local" | "minio" | "s3"> {
  const c = config ?? {};
  return {
    local: {
      ...DEFAULT_LOCAL_PROVIDER_CONFIG,
      path: asString(c.path, DEFAULT_LOCAL_PROVIDER_CONFIG.path),
      bucket: asString(c.bucket, ""),
    },
    minio: {
      ...DEFAULT_MINIO_PROVIDER_CONFIG,
      endpoint: asString(c.endpoint, DEFAULT_MINIO_PROVIDER_CONFIG.endpoint),
      port: asOptionalNumber(c.port) ?? DEFAULT_MINIO_PROVIDER_CONFIG.port,
      publicEndpoint: asString(
        c.publicEndpoint,
        DEFAULT_MINIO_PROVIDER_CONFIG.publicEndpoint ?? "",
      ),
      bucket: asString(c.bucket, DEFAULT_MINIO_PROVIDER_CONFIG.bucket),
      accessKeyId: asString(
        c.accessKeyId,
        DEFAULT_MINIO_PROVIDER_CONFIG.accessKeyId,
      ),
      secretAccessKey: asString(
        c.secretAccessKey,
        DEFAULT_MINIO_PROVIDER_CONFIG.secretAccessKey,
      ),
      useSSL: asBool(c.useSSL, false),
      region: asString(c.region, DEFAULT_MINIO_PROVIDER_CONFIG.region ?? ""),
      signedUrlExpiresIn: asOptionalNumber(c.signedUrlExpiresIn),
    },
    s3: {
      ...DEFAULT_S3_PROVIDER_CONFIG,
      bucket: asString(c.bucket, ""),
      region: asString(c.region, DEFAULT_S3_PROVIDER_CONFIG.region),
      accessKeyId: asString(c.accessKeyId, ""),
      secretAccessKey: asString(c.secretAccessKey, ""),
      endpoint: asString(c.endpoint, ""),
      publicEndpoint: asString(c.publicEndpoint, ""),
      forcePathStyle: asBool(c.forcePathStyle, false),
      signedUrlExpiresIn: asOptionalNumber(c.signedUrlExpiresIn),
    },
  };
}

export function defaultProviderFormValues(
  type: ProviderType = ProviderType.LOCAL,
): ProviderFormValues {
  return {
    name: "",
    type,
    isActive: true,
    isDefault: false,
    local: { ...DEFAULT_LOCAL_PROVIDER_CONFIG },
    minio: { ...DEFAULT_MINIO_PROVIDER_CONFIG },
    s3: { ...DEFAULT_S3_PROVIDER_CONFIG },
  };
}

function omitEmpty<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

/** Build the JSON `config` object persisted on the provider row. */
export function formValuesToProviderConfig(
  values: ProviderFormValues,
): Record<string, unknown> {
  if (values.type === ProviderType.LOCAL) {
    return omitEmpty({
      path: values.local.path,
      bucket: values.local.bucket,
    });
  }

  if (values.type === ProviderType.MINIO) {
    return omitEmpty({
      endpoint: values.minio.endpoint,
      port:
        values.minio.port != null ? String(values.minio.port) : undefined,
      publicEndpoint: values.minio.publicEndpoint,
      bucket: values.minio.bucket,
      accessKeyId: values.minio.accessKeyId,
      secretAccessKey: values.minio.secretAccessKey,
      useSSL: values.minio.useSSL,
      region: values.minio.region || "us-east-1",
      signedUrlExpiresIn: values.minio.signedUrlExpiresIn,
    });
  }

  return omitEmpty({
    bucket: values.s3.bucket,
    region: values.s3.region,
    accessKeyId: values.s3.accessKeyId,
    secretAccessKey: values.s3.secretAccessKey,
    endpoint: values.s3.endpoint,
    publicEndpoint: values.s3.publicEndpoint,
    forcePathStyle: values.s3.forcePathStyle,
    signedUrlExpiresIn: values.s3.signedUrlExpiresIn,
  });
}
