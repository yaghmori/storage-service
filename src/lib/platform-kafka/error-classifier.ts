// Error classification for determining retry strategy
// Classifies errors as transient (retryable) or permanent (send to DLQ)

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Whether the error is transient and should be retried */
  isTransient: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
  /** Error category for metrics and logging */
  category: ErrorCategory;
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Network errors, timeouts - retryable */
  NETWORK = 'NETWORK',
  /** Rate limiting - retryable with backoff */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Validation errors - permanent, send to DLQ */
  VALIDATION = 'VALIDATION',
  /** Business logic errors - permanent, send to DLQ */
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  /** Authentication/authorization errors - permanent, send to DLQ */
  AUTH = 'AUTH',
  /** Unknown errors - treat as transient for safety */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classify an error to determine if it's transient (retryable) or permanent (send to DLQ).
 * 
 * Transient errors:
 * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, etc.)
 * - Timeout errors
 * - Rate limiting errors
 * - Temporary service unavailability
 * 
 * Permanent errors:
 * - Validation errors
 * - Business logic errors (e.g., invalid state)
 * - Authentication/authorization errors
 * - Malformed data errors
 */
export function classifyError(error: unknown): ErrorClassification {
  if (!(error instanceof Error)) {
    // Non-Error objects - treat as unknown/transient
    return {
      isTransient: true,
      category: ErrorCategory.UNKNOWN,
      retryDelay: 2000,
    };
  }

  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Network errors - retryable
  if (
    errorName.includes('network') ||
    errorName.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection refused') ||
    errorMessage.includes('connection reset')
  ) {
    return {
      isTransient: true,
      category: ErrorCategory.NETWORK,
      retryDelay: 2000, // 2 seconds
    };
  }

  // Rate limiting - retryable with longer backoff
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429') ||
    errorMessage.includes('quota exceeded') ||
    errorMessage.includes('throttle')
  ) {
    return {
      isTransient: true,
      category: ErrorCategory.RATE_LIMIT,
      retryDelay: 60000, // 1 minute
    };
  }

  // Validation errors - permanent
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('malformed') ||
    errorMessage.includes('schema') ||
    errorMessage.includes('parse') ||
    errorName.includes('validation') ||
    errorName.includes('zod')
  ) {
    return {
      isTransient: false,
      category: ErrorCategory.VALIDATION,
    };
  }

  // Authentication/authorization errors - permanent
  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('authorization') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403') ||
    errorName.includes('unauthorized') ||
    errorName.includes('forbidden')
  ) {
    return {
      isTransient: false,
      category: ErrorCategory.AUTH,
    };
  }

  // Business logic errors (common patterns) - permanent
  if (
    errorMessage.includes('not found') ||
    errorMessage.includes('already exists') ||
    errorMessage.includes('duplicate') ||
    errorMessage.includes('conflict') ||
    errorMessage.includes('409') ||
    errorMessage.includes('404') ||
    errorMessage.includes('no connected repository') ||
    errorMessage.includes('no available build runners') ||
    errorMessage.includes('build failed') ||
    errorMessage.includes('exit code')
  ) {
    return {
      isTransient: false,
      category: ErrorCategory.BUSINESS_LOGIC,
    };
  }

  // Database constraint / type errors — permanent (retrying won't fix bad data)
  if (
    errorName.includes('drizzle') ||
    errorMessage.includes('failed query') ||
    errorMessage.includes('invalid input syntax') ||
    errorMessage.includes('violates') ||
    errorMessage.includes('constraint')
  ) {
    return {
      isTransient: false,
      category: ErrorCategory.VALIDATION,
    };
  }

  // Unknown errors - treat as transient for safety (better to retry than lose messages)
  return {
    isTransient: true,
    category: ErrorCategory.UNKNOWN,
    retryDelay: 2000,
  };
}

/**
 * Check if an error should trigger a retry.
 */
export function shouldRetry(error: unknown): boolean {
  return classifyError(error).isTransient;
}

/**
 * Get suggested retry delay for an error.
 */
export function getRetryDelay(error: unknown): number {
  return classifyError(error).retryDelay || 2000;
}

