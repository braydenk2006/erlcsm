export type ProductEvent = {
  name: string;
  organizationId?: string;
  userId?: string;
  properties?: Record<string, string | number | boolean | null>;
};

/** Product telemetry must not include message/document contents. */
export function assertSafeAnalyticsProperties(properties: Record<string, unknown>): void {
  for (const key of Object.keys(properties)) {
    if (/(content|body|message|document|prompt)/i.test(key)) {
      throw new Error(`Analytics property "${key}" is not permitted`);
    }
  }
}
