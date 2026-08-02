export const QUEUE_NAMES = {
  system: "commandry.system",
  moderationExpiration: "commandry.moderation.expiration",
  notifications: "commandry.notifications",
  integrations: "commandry.integrations",
} as const;

export type SystemJobName = "health.check" | "demo.echo";
