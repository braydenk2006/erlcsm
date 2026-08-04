"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

const client = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.APP_URL,
  plugins: [magicLinkClient()],
});

export { client as authClient };
