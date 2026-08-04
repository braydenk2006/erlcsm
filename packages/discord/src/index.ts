export type DiscordConnectionStatus = "disconnected" | "connected" | "degraded";

export function getDiscordSetupStatus(env: {
  clientId?: string;
  clientSecret?: string;
  botToken?: string;
}): { oauthConfigured: boolean; botConfigured: boolean; status: DiscordConnectionStatus } {
  const oauthConfigured = Boolean(env.clientId && env.clientSecret);
  const botConfigured = Boolean(env.botToken);
  return {
    oauthConfigured,
    botConfigured,
    status: oauthConfigured || botConfigured ? "degraded" : "disconnected",
  };
}
