export * from "./hub";

export type IntegrationProvider =
  "erlc" | "discord" | "roblox" | "stripe" | "email" | "storage" | "webhook";

export type IntegrationHealth = {
  provider: IntegrationProvider;
  status: "disconnected" | "connected" | "degraded" | "error";
  lastSuccessAt?: Date | null;
  message: string;
};

export {
  connectErlc,
  disconnectErlc,
  checkErlcHealth,
  getErlcIntegration,
  getErlcClientForOrganization,
  syncCadFromErlc,
  correlatePlayerHistory,
  recordErlcCallWebhook,
  listCadCalls,
  listPlayerHistory,
  type ErlcConnectInput,
  type ErlcIntegrationSummary,
  type ErlcResolvedClient,
  type CadCallView,
  type PlayerHistoryView,
} from "./erlc-service";
export {
  getDiscordClientForOrganization,
  createMockDiscordClient,
  createLiveDiscordClient,
  connectDiscord,
  getDiscordIntegration,
  DiscordError,
  type DiscordClient,
  type DiscordScheduledEventInput,
  type DiscordIntegrationSummary,
} from "./discord-service";
