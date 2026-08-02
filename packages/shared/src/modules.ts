export const MODULES = [
  "home",
  "live_server",
  "people",
  "staff",
  "departments",
  "moderation",
  "sessions",
  "activity",
  "applications",
  "training",
  "cad",
  "documents",
  "forms",
  "automations",
  "analytics",
  "website",
  "integrations",
  "settings",
] as const;

export type ModuleKey = (typeof MODULES)[number];
