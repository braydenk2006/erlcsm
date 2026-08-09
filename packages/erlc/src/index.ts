export type {
  ErlcMode,
  ErlcTeam,
  ErlcPermission,
  ErlcLocation,
  ErlcPlayer,
  ErlcServerStatus,
  ErlcVehicle,
  ErlcJoinLeaveLog,
  ErlcKillLog,
  ErlcCommandLog,
  ErlcCallStatus,
  ErlcCallLog,
  ErlcTeamCount,
  ErlcSnapshot,
  ErlcRunCommandResult,
  ErlcRateLimit,
  ErlcHealthStatus,
  ErlcHealthResult,
  ErlcClient,
} from "./types";
export { ERLC_TEAMS } from "./types";

export {
  ErlcError,
  ErlcNotConfiguredError,
  ErlcAuthError,
  ErlcRateLimitError,
  ErlcOutageError,
  isErlcError,
  type ErlcErrorCode,
} from "./errors";

export { createErlcSimulator, type SimulatorOptions } from "./simulator";
export { createLiveErlcClient, type LiveClientOptions } from "./live-client";
export { createErlcClient, resolveErlcMode, type ErlcClientConfig } from "./factory";
export { signErlcWebhook, verifyErlcWebhook, parseCallWebhook } from "./webhook";
export { TokenBucket, parseRateLimitHeaders, retryAfterFromResponse } from "./rate-limit";
