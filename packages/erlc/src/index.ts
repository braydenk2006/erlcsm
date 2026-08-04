export type ErlcMode = "simulator" | "live";

export type ErlcClient = {
  mode: ErlcMode;
  getServerStatus(): Promise<{ connected: boolean; players?: number; message: string }>;
};

/** Development simulator — never claims a production ER:LC connection. */
export function createErlcSimulator(): ErlcClient {
  return {
    mode: "simulator",
    async getServerStatus() {
      return {
        connected: false,
        message: "ER:LC simulator mode active. Connect encrypted credentials to enable live mode.",
      };
    },
  };
}
