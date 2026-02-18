import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const rootEnvPath = path.resolve(currentDir, "../../../../.env");
const localEnvPath = path.resolve(currentDir, "../../.env");

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: localEnvPath, override: true });

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: asNumber(process.env.USER_BE_PORT, 5001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};
