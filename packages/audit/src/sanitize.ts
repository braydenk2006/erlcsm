const SENSITIVE_KEY =
  /(password|secret|token|api[_-]?key|authorization|cookie|ciphertext|private[_-]?key)/i;

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditMetadata);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeAuditMetadata(nested);
      }
    }
    return output;
  }
  return value;
}
