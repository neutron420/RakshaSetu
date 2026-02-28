import { createServer } from "node:http";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { connectProducer, disconnectProducer, initTopics } from "@rakshasetu/kafka";
import { prisma } from "./common/db/prisma";
import { errorMiddleware } from "./common/middleware/error.middleware";
import { notFoundMiddleware } from "./common/middleware/not-found.middleware";
import { apiRouter } from "./routes";
import { initWebSocket, getConnectedCount } from "./ws";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient, connectRedis } from "./common/db/redis";

await connectRedis();

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "user-be",
    status: "ok",
    wsClients: getConnectedCount(),
  });
});

// Configure Redis-backed Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 300,            
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
});

// Apply rate limiter to all API routes
app.use("/api/", globalLimiter);

app.use("/api/v1", apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const httpServer = createServer(app);
initWebSocket(httpServer);

import { processOutbox } from "./modules/outbox/outbox.service";
import { pollDisasterEvents } from "./modules/alerts/disaster-ingestion.service";
import { pollWeatherAlerts } from "./modules/alerts/weather-ingestion.service";
import { startAlertTargetingWorker } from "./modules/alerts/alert-targeting.worker";
import { startDispatchWorker } from "./modules/dispatch/dispatch.worker";

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "TimeoutNegativeWarning") return;
  console.warn(warning);
});

httpServer.listen(env.port, async () => {
  await initTopics().catch((err: any) => {
    console.warn("[kafka] topic init failed:", err.message);
  });
  await connectProducer().catch((err: unknown) => {
    console.warn("[kafka] producer connect failed (events will still go to WebSocket):", err instanceof Error ? err.message : err);
  });
  console.log(`user-be running on port ${env.port}`);
});

// Delay first outbox poll to let DB pool warm up (avoids timeout on Neon cold start)
setTimeout(() => {
  setInterval(() => {
    void processOutbox().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unable to start a transaction")) return; // Neon cold start, ignore
      console.error("[outbox] error:", msg);
    });
  }, 5000);
}, 10000);

// Start Early Warning System (EWS) components
setTimeout(() => {
  console.log("[EWS] Starting disaster ingestion and targeting worker...");
  void startAlertTargetingWorker().catch(err => console.error("[EWS] Targeting worker failed:", err));
  void startDispatchWorker().catch(err => console.error("[dispatch] Worker failed:", err));
  
  // Poll USGS every 10 minutes
  void pollDisasterEvents();
  setInterval(() => {
    void pollDisasterEvents();
  }, 10 * 60 * 1000);

  // Poll Weather alerts every 15 minutes
  void pollWeatherAlerts();
  setInterval(() => {
    void pollWeatherAlerts();
  }, 15 * 60 * 1000);
}, 15000);

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  httpServer.close(async () => {
    try {
      await disconnectProducer();
    } catch (err) {
      console.warn("[kafka] disconnect:", err instanceof Error ? err.message : err);
    }
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
