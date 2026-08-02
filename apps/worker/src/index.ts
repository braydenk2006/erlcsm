import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@commandry/database";
import { createLogger } from "@commandry/observability";
import { QUEUE_NAMES, type SystemJobName } from "./queues";

const log = createLogger({ service: "worker" });

function createConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required");
  }
  return new IORedis(url, { maxRetriesPerRequest: null });
}

async function main() {
  const connection = createConnection();
  const systemQueue = new Queue(QUEUE_NAMES.system, { connection });

  const worker = new Worker<{ message?: string }, { ok: true; echo: string }, SystemJobName>(
    QUEUE_NAMES.system,
    async (job) => {
      if (job.name === "health.check") {
        await prisma.$queryRaw`SELECT 1`;
        log.info("Health check job succeeded", { jobId: job.id });
        return { ok: true as const, echo: "healthy" };
      }

      if (job.name === "demo.echo") {
        const echo = job.data.message ?? "pong";
        log.info("Echo job processed", { jobId: job.id, echo });
        return { ok: true as const, echo };
      }

      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection },
  );

  worker.on("failed", async (job, error) => {
    log.error("Job failed", {
      jobId: job?.id,
      name: job?.name,
      error: error.message,
    });
    await prisma.jobFailure.create({
      data: {
        queue: QUEUE_NAMES.system,
        jobName: job?.name ?? "unknown",
        jobId: job?.id,
        payload: job?.data ?? {},
        error: error.message,
        attempts: job?.attemptsMade ?? 0,
      },
    });
  });

  await systemQueue.add(
    "health.check",
    {},
    {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );

  log.info("Commandry worker started", { queues: Object.values(QUEUE_NAMES) });

  const shutdown = async () => {
    log.info("Shutting down worker");
    await worker.close();
    await systemQueue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch(async (error) => {
  log.error("Worker failed to start", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
