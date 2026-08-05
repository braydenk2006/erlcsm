import { createHmac, timingSafeEqual } from "node:crypto";
import type { ErlcCallLog } from "./types";

/** Compute the hex HMAC-SHA256 signature for a raw webhook body. */
export function signErlcWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Verify an inbound ER:LC/CAD webhook using an HMAC-SHA256 shared secret.
 * The comparison is constant-time to avoid signature timing oracles.
 * Accepts signatures with or without a `sha256=` prefix.
 */
export function verifyErlcWebhook(input: {
  rawBody: string;
  signature: string | null | undefined;
  secret: string;
}): boolean {
  const { rawBody, signature, secret } = input;
  if (!signature || !secret) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  const expected = signErlcWebhook(rawBody, secret);
  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length || providedBuf.length === 0) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Parse a verified webhook payload into an emergency call. Supports the common
 * shapes emitted by ER:LC 911/CAD relays; returns null when the payload is not
 * a recognizable call event.
 */
export function parseCallWebhook(payload: unknown, receivedAt: Date): ErlcCallLog | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.description === "string"
        ? record.description
        : null;
  if (message === null) return null;

  const caller =
    typeof record.caller === "string"
      ? record.caller
      : typeof record.player === "string"
        ? record.player
        : "Unknown";
  const callerIdRaw = record.callerId ?? record.playerId;
  const callerId = typeof callerIdRaw === "number" ? callerIdRaw : Number(callerIdRaw);

  const statusRaw = String(record.status ?? "pending").toLowerCase();
  const status: ErlcCallLog["status"] =
    statusRaw === "active" || statusRaw === "closed" ? statusRaw : "pending";

  const id =
    typeof record.id === "string"
      ? record.id
      : `call-${receivedAt.getTime()}-${Math.floor(Math.random() * 1e6)}`;

  return {
    id,
    number: typeof record.number === "string" ? record.number : "911",
    caller,
    callerId: Number.isFinite(callerId) ? callerId : null,
    message,
    location: typeof record.location === "string" ? record.location : null,
    status,
    at: receivedAt,
  };
}
