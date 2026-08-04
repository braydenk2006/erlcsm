export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly expose: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      status: number;
      details?: Record<string, unknown>;
      expose?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.expose = options.expose ?? options.status < 500;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, { code: "UNAUTHORIZED", status: 401 });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, { code: "FORBIDDEN", status: 403 });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, { code: "NOT_FOUND", status: 404 });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super(message, { code: "VALIDATION_ERROR", status: 400, details });
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, { code: "CONFLICT", status: 409 });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, { code: "RATE_LIMITED", status: 429 });
    this.name = "RateLimitError";
  }
}
