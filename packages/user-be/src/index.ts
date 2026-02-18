import { createServer } from "node:http";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { prisma } from "./common/db/prisma";
import { errorMiddleware } from "./common/middleware/error.middleware";
import { notFoundMiddleware } from "./common/middleware/not-found.middleware";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { initWebSocket, getConnectedCount } from "./ws";

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

app.use("/api/v1", apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const httpServer = createServer(app);
initWebSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`user-be running on port ${env.port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  httpServer.close(async () => {
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
