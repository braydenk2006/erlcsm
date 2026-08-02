import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("credential encryption", () => {
  it("round-trips secrets", () => {
    const secret = "test-encryption-key-with-32-chars!!";
    const encrypted = encryptSecret("erlc-api-key-value", secret);
    expect(encrypted.ciphertext).not.toContain("erlc-api-key-value");
    expect(decryptSecret(encrypted, secret)).toBe("erlc-api-key-value");
  });
});
