import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  APP_NAME: z.string().default("Ordinex"),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Ordinex <noreply@localhost>"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ERLC_MODE: z.enum(["simulator", "live"]).default("simulator"),
  AI_PROVIDER: z.enum(["none", "openai", "anthropic"]).default("none"),
});

export type AppEnv = z.infer<typeof envSchema>;
