import { createPublicId } from "@commandry/shared";

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "authorization",
  "cookie",
  "credentials",
  "erlcApiKey",
  "discordBotToken",
  "stripeSecretKey",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key) || /secret|token|password|apikey|api_key/i.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redact(nested);
      }
    }
    return output;
  }
  return value;
}

export type LogContext = {
  requestId?: string;
  userId?: string;
  organizationId?: string;
  [key: string]: unknown;
};

export function createRequestId(): string {
  return createPublicId("req");
}

export function createLogger(defaultContext: LogContext = {}) {
  const level = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  const order: LogLevel[] = ["debug", "info", "warn", "error"];

  function shouldLog(candidate: LogLevel): boolean {
    return order.indexOf(candidate) >= order.indexOf(level);
  }

  function write(candidate: LogLevel, message: string, context?: LogContext) {
    if (!shouldLog(candidate)) return;
    const payload = {
      level: candidate,
      message,
      timestamp: new Date().toISOString(),
      ...((redact({ ...defaultContext, ...context }) as LogContext) ?? {}),
    };
    const line = JSON.stringify(payload);
    if (candidate === "error") {
      console.error(line);
    } else if (candidate === "warn") {
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }

  return {
    debug: (message: string, context?: LogContext) => write("debug", message, context),
    info: (message: string, context?: LogContext) => write("info", message, context),
    warn: (message: string, context?: LogContext) => write("warn", message, context),
    error: (message: string, context?: LogContext) => write("error", message, context),
    child: (context: LogContext) => createLogger({ ...defaultContext, ...context }),
  };
}

export const logger = createLogger();
