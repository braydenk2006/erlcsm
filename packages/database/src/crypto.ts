import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "commandry-credentials", 32);
}

export function encryptSecret(
  plaintext: string,
  secret = process.env.CREDENTIALS_ENCRYPTION_KEY,
): { ciphertext: string; iv: string; authTag: string } {
  if (!secret || secret.length < 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(
  payload: { ciphertext: string; iv: string; authTag: string },
  secret = process.env.CREDENTIALS_ENCRYPTION_KEY,
): string {
  if (!secret || secret.length < 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters");
  }
  const decipher = createDecipheriv(ALGO, deriveKey(secret), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
