import { createErlcSimulator, type SimulatorOptions } from "./simulator";
import { createLiveErlcClient, type LiveClientOptions } from "./live-client";
import type { ErlcClient, ErlcMode } from "./types";

export type ErlcClientConfig =
  ({ mode: "simulator" } & SimulatorOptions) | ({ mode: "live" } & LiveClientOptions);

/**
 * Build the appropriate ER:LC client for a given mode. The rest of the app
 * depends only on the `ErlcClient` interface, so switching between the
 * simulator and a live server never changes call sites.
 */
export function createErlcClient(config: ErlcClientConfig): ErlcClient {
  if (config.mode === "live") {
    const { mode: _mode, ...options } = config;
    return createLiveErlcClient(options);
  }
  const { mode: _mode, ...options } = config;
  return createErlcSimulator(options);
}

export function resolveErlcMode(value: string | undefined): ErlcMode {
  return value === "live" ? "live" : "simulator";
}
