export type IntegrationProvider =
  "erlc" | "discord" | "roblox" | "stripe" | "email" | "storage" | "webhook";

export type IntegrationHealth = {
  provider: IntegrationProvider;
  status: "disconnected" | "connected" | "degraded" | "error";
  lastSuccessAt?: Date | null;
  message: string;
};
