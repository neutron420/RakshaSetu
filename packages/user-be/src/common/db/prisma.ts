import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../../../prisma/generated/prisma";
import { env } from "../../config/env";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Append uselibpqcompat to silence pg-connection-string SSL deprecation warning
  const connStr = env.databaseUrl.includes("uselibpqcompat")
    ? env.databaseUrl
    : `${env.databaseUrl}&uselibpqcompat=true`;
  const pool = new pg.Pool({ connectionString: connStr });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      env.nodeEnv === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma = globalForPrisma.__prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.__prisma = prisma;
}
