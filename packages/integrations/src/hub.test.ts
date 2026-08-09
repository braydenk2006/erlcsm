import { describe, expect, it } from "vitest";
import {
  API_SCOPES,
  computeOverallHealth,
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  isApiScope,
  isSafeWebhookUrl,
  signWebhookPayload,
  webhookBackoffMs,
  type IntegrationStatus,
} from "./hub";

const card = (status: IntegrationStatus, configured = true) => ({ status, configured });

describe("overall health", () => {
  it("is deterministic and severity-ordered", () => {
    expect(computeOverallHealth([card("CONNECTED"), card("CONNECTED")])).toBe("HEALTHY");
    expect(computeOverallHealth([card("CONNECTED"), card("DEGRADED")])).toBe("DEGRADED");
    expect(computeOverallHealth([card("CONFIGURATION_REQUIRED")])).toBe("ACTION_REQUIRED");
    expect(computeOverallHealth([card("CONNECTED"), card("ERROR")])).toBe("OUTAGE");
  });
  it("ignores never-configured disconnected integrations", () => {
    expect(computeOverallHealth([card("CONNECTED"), card("DISCONNECTED", false)])).toBe("HEALTHY");
  });
});

describe("SSRF guard", () => {
  it("allows public HTTPS and blocks private/loopback/metadata", () => {
    expect(isSafeWebhookUrl("https://hooks.example.com/x").ok).toBe(true);
    expect(isSafeWebhookUrl("http://hooks.example.com/x").ok).toBe(false); // not https
    expect(isSafeWebhookUrl("https://localhost/x").ok).toBe(false);
    expect(isSafeWebhookUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(isSafeWebhookUrl("https://10.0.0.5/x").ok).toBe(false);
    expect(isSafeWebhookUrl("https://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(isSafeWebhookUrl("https://foo.internal/x").ok).toBe(false);
    expect(isSafeWebhookUrl("not a url").ok).toBe(false);
  });
});

describe("webhook signing + backoff", () => {
  it("signs deterministically and differs by secret", () => {
    const a = signWebhookPayload("{}", "s1", 1000);
    expect(a).toBe(signWebhookPayload("{}", "s1", 1000));
    expect(a).not.toBe(signWebhookPayload("{}", "s2", 1000));
    expect(generateWebhookSecret()).toMatch(/^whsec_/);
  });
  it("uses exponential backoff with a cap", () => {
    expect(webhookBackoffMs(0, 2000, 300000)).toBe(2000);
    expect(webhookBackoffMs(3, 2000, 300000)).toBe(16000);
    expect(webhookBackoffMs(30, 2000, 300000)).toBe(300000);
  });
});

describe("api keys", () => {
  it("generates a prefixed key, hashes it, and never repeats", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).toMatch(/^ordx_/);
    expect(a.prefix).toBe(a.plaintext.slice(0, 12));
    expect(a.hashed).toBe(hashApiKey(a.plaintext));
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hashed).not.toBe(hashApiKey("wrong"));
  });
  it("validates scopes", () => {
    expect(isApiScope("members.read")).toBe(true);
    expect(isApiScope("evil.write")).toBe(false);
    expect(API_SCOPES.length).toBeGreaterThan(0);
  });
});
