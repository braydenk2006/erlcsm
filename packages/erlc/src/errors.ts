/**
 * Transport-level errors for the ER:LC client. These are intentionally
 * independent of the app-wide `AppError` hierarchy so `@commandry/erlc` stays
 * dependency-free; the integrations/web layers map them to HTTP responses.
 */

export type ErlcErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "OUTAGE"
  | "BAD_RESPONSE"
  | "COMMAND_FAILED";

export class ErlcError extends Error {
  readonly code: ErlcErrorCode;
  /** True when a retry (after backoff) may succeed. */
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    message: string,
    options: { code: ErlcErrorCode; retryable?: boolean; status?: number | null; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "ErlcError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}

export class ErlcNotConfiguredError extends ErlcError {
  constructor(message = "ER:LC credentials are not configured for this organization") {
    super(message, { code: "NOT_CONFIGURED", retryable: false });
    this.name = "ErlcNotConfiguredError";
  }
}

export class ErlcAuthError extends ErlcError {
  constructor(message = "ER:LC rejected the server key", status: number | null = 401) {
    super(message, { code: "UNAUTHORIZED", retryable: false, status });
    this.name = "ErlcAuthError";
  }
}

export class ErlcRateLimitError extends ErlcError {
  /** Milliseconds to wait before retrying. */
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message = "ER:LC API rate limit reached") {
    super(message, { code: "RATE_LIMITED", retryable: true, status: 429 });
    this.name = "ErlcRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Upstream network failure or 5xx — the ER:LC service is degraded/unavailable. */
export class ErlcOutageError extends ErlcError {
  constructor(message = "The ER:LC service is currently unavailable", status: number | null = null) {
    super(message, { code: "OUTAGE", retryable: true, status });
    this.name = "ErlcOutageError";
  }
}

export function isErlcError(value: unknown): value is ErlcError {
  return value instanceof ErlcError;
}
