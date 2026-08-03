/**
 * Extract a user-facing message from API / upstream error envelopes.
 */
export function extractApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error == null) return fallback;

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    if (error.message !== "[object Object]") {
      return error.message;
    }
  }

  const e = error as {
    errors?: Array<{ message?: unknown }>;
    message?: unknown;
    response?: {
      data?: {
        message?: unknown;
        errors?: Array<{ message?: unknown }>;
      };
    };
  };

  const candidates: unknown[] = [
    e.errors?.[0]?.message,
    e.response?.data?.errors?.[0]?.message,
    e.response?.data?.message,
    e.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      if (candidate === "[object Object]") continue;
      return candidate;
    }
  }

  return fallback;
}
