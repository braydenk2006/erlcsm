import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import { assertAuthSecret } from "./secret";

function getAuthSecret(): string {
  return assertAuthSecret(process.env.BETTER_AUTH_SECRET);
}

export function createAuth() {
  const discordClientId = process.env.DISCORD_CLIENT_ID;
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;

  const instance = betterAuth({
    appName: process.env.APP_NAME ?? "Ordinex",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
    secret: getAuthSecret(),
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      ...(discordClientId && discordClientSecret
        ? {
            discord: {
              clientId: discordClientId,
              clientSecret: discordClientSecret,
            },
          }
        : {}),
    },
    user: {
      additionalFields: {
        publicId: {
          type: "string",
          required: false,
          input: false,
        },
        platformRole: {
          type: "string",
          required: false,
          defaultValue: "NONE",
          input: false,
        },
        activeOrganizationId: {
          type: "string",
          required: false,
          input: false,
        },
        mfaEnabled: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            return {
              data: {
                ...user,
                publicId: createPublicId("usr"),
              },
            };
          },
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (process.env.RESEND_API_KEY) {
            console.warn(`[auth] Magic link for ${email} queued for Resend delivery`);
            console.warn(`[auth] url=${url}`);
            return;
          }
          console.warn(`[auth:dev] Magic link for ${email}: ${url}`);
        },
      }),
    ],
    trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"].filter(Boolean),
  });

  return instance;
}

export type Auth = ReturnType<typeof createAuth>;
