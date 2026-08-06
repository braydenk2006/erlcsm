import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@commandry/api",
    "@commandry/audit",
    "@commandry/auth",
    "@commandry/cad",
    "@commandry/ai",
    "@commandry/automation",
    "@commandry/command-center",
    "@commandry/database",
    "@commandry/entitlements",
    "@commandry/insights",
    "@commandry/knowledge",
    "@commandry/erlc",
    "@commandry/operations",
    "@commandry/roblox",
    "@commandry/website",
    "@commandry/workflow",
    "@commandry/integrations",
    "@commandry/observability",
    "@commandry/permissions",
    "@commandry/shared",
    "@commandry/ui",
    "@commandry/validation",
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
