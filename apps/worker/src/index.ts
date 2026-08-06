import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@commandry/database";
import { createLogger } from "@commandry/observability";
import { QUEUE_NAMES, type SystemJobName } from "./queues";
import { runErlcMaintenance } from "./erlc-maintenance";
import { runCadExpiration } from "./cad-maintenance";
import { runOperationsMaintenance } from "./operations-maintenance";
import { runSchedulingMaintenance } from "./scheduling-maintenance";
import { runAutomationDispatch } from "./automation-dispatch";

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

  // Integrations queue: ER:LC health monitoring, CAD sync, player-history.
  const integrationsQueue = new Queue(QUEUE_NAMES.integrations, { connection });
  const integrationsWorker = new Worker(
    QUEUE_NAMES.integrations,
    async (job) => {
      if (job.name === "erlc.maintenance") {
        return runErlcMaintenance();
      }
      if (job.name === "cad.expiration") {
        return runCadExpiration();
      }
      if (job.name === "operations.maintenance") {
        return runOperationsMaintenance();
      }
      if (job.name === "scheduling.maintenance") {
        return runSchedulingMaintenance();
      }
      if (job.name === "automation.dispatch") {
        return runAutomationDispatch();
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection },
  );
  integrationsWorker.on("failed", (job, error) => {
    log.error("Integrations job failed", {
      jobId: job?.id,
      name: job?.name,
      error: error.message,
    });
  });

  // Run once now, then on a 60s cadence (ER:LC health/player-history + CAD expiration).
  await integrationsQueue.add("erlc.maintenance", {}, { removeOnComplete: 50, removeOnFail: 50 });
  await integrationsQueue.add("cad.expiration", {}, { removeOnComplete: 50, removeOnFail: 50 });
  await integrationsQueue.add(
    "operations.maintenance",
    {},
    { removeOnComplete: 50, removeOnFail: 50 },
  );
  await integrationsQueue.add(
    "scheduling.maintenance",
    {},
    { removeOnComplete: 50, removeOnFail: 50 },
  );
  await integrationsQueue.add(
    "automation.dispatch",
    {},
    { removeOnComplete: 50, removeOnFail: 50 },
  );
  const maintenanceTimer = setInterval(() => {
    void integrationsQueue
      .add("erlc.maintenance", {}, { removeOnComplete: 50, removeOnFail: 50 })
      .catch((error) => {
        log.error("Failed to enqueue ER:LC maintenance", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    void integrationsQueue
      .add("cad.expiration", {}, { removeOnComplete: 50, removeOnFail: 50 })
      .catch((error) => {
        log.error("Failed to enqueue CAD expiration", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    void integrationsQueue
      .add("operations.maintenance", {}, { removeOnComplete: 50, removeOnFail: 50 })
      .catch((error) => {
        log.error("Failed to enqueue operations maintenance", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    void integrationsQueue
      .add("scheduling.maintenance", {}, { removeOnComplete: 50, removeOnFail: 50 })
      .catch((error) => {
        log.error("Failed to enqueue scheduling maintenance", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    void integrationsQueue
      .add("automation.dispatch", {}, { removeOnComplete: 50, removeOnFail: 50 })
      .catch((error) => {
        log.error("Failed to enqueue automation dispatch", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
  }, 15000);

  log.info("Ordinex worker started", { queues: Object.values(QUEUE_NAMES) });

  const shutdown = async () => {
    log.info("Shutting down worker");
    clearInterval(maintenanceTimer);
    await worker.close();
    await integrationsWorker.close();
    await systemQueue.close();
    await integrationsQueue.close();
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
