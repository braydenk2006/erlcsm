import { NextResponse } from "next/server";
import { AppError } from "@commandry/shared";
import { isErlcError } from "@commandry/erlc";
import { logger } from "@commandry/observability";

/** Map thrown errors (AppError, ER:LC transport errors, unknown) to responses. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    // Structured entitlement/limit errors carry safe, non-sensitive details.
    if (error.code === "FEATURE_NOT_ENTITLED" || error.code === "LIMIT_EXCEEDED") {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, ...(error.details ?? {}) } },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error.expose ? error.message : "Request failed", code: error.code },
      { status: error.status },
    );
  }

  if (isErlcError(error)) {
    const status =
      error.code === "NOT_CONFIGURED"
        ? 409
        : error.code === "UNAUTHORIZED"
          ? 502
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "OUTAGE"
              ? 503
              : 502;
    return NextResponse.json(
      { error: error.message, code: error.code, retryable: error.retryable },
      { status },
    );
  }

  logger.error("Unhandled route error", {
    error: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
