import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "discord-bot" });

/**
 * Discord bot runtime is scaffolded for Release 5.
 * Without DISCORD_BOT_TOKEN, the process starts in idle diagnostic mode and does not
 * claim a live Discord connection.
 */
async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    log.warn("DISCORD_BOT_TOKEN is not configured; bot idle mode active");
    return;
  }

  log.info("Discord bot token detected; full slash-command runtime ships in Release 5");
}

main().catch((error) => {
  log.error("Discord bot failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
