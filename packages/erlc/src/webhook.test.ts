import { describe, expect, it } from "vitest";
import { parseCallWebhook, signErlcWebhook, verifyErlcWebhook } from "./webhook";

describe("verifyErlcWebhook", () => {
  const secret = "webhook-shared-secret-value";
  const body = JSON.stringify({ message: "Armed robbery", caller: "Ava", callerId: 5 });

  it("accepts a correct signature (with and without prefix)", () => {
    const sig = signErlcWebhook(body, secret);
    expect(verifyErlcWebhook({ rawBody: body, signature: sig, secret })).toBe(true);
    expect(verifyErlcWebhook({ rawBody: body, signature: `sha256=${sig}`, secret })).toBe(true);
  });

  it("rejects a tampered body, wrong secret, and missing signature", () => {
    const sig = signErlcWebhook(body, secret);
    expect(verifyErlcWebhook({ rawBody: body + "x", signature: sig, secret })).toBe(false);
    expect(
      verifyErlcWebhook({
        rawBody: body,
        signature: sig,
        secret: "other-secret-value-32chars-min",
      }),
    ).toBe(false);
    expect(verifyErlcWebhook({ rawBody: body, signature: null, secret })).toBe(false);
  });
});

describe("parseCallWebhook", () => {
  it("parses a recognizable 911 call payload", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const call = parseCallWebhook(
      {
        id: "c1",
        message: "Fire reported",
        caller: "Liam",
        callerId: 9,
        location: "Downtown",
        status: "active",
      },
      now,
    );
    expect(call).not.toBeNull();
    expect(call).toMatchObject({
      id: "c1",
      caller: "Liam",
      callerId: 9,
      status: "active",
      number: "911",
    });
  });

  it("returns null for unrecognized payloads", () => {
    expect(parseCallWebhook({ foo: "bar" }, new Date())).toBeNull();
    expect(parseCallWebhook(null, new Date())).toBeNull();
  });
});
