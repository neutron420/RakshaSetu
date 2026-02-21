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

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.trim()) {
  throw new Error(
    "DATABASE_URL is required. Set it in .env (root or packages/user-be/.env). See .env.example."
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: asNumber(process.env.USER_BE_PORT, 5001),
  databaseUrl,
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  // R2 Storage
  r2Endpoint: process.env.R2_ENDPOINT ?? "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "mock_access_key",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "mock_secret_key",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "rakshasetu-media",
  r2PublicDomain: process.env.R2_PUBLIC_DOMAIN,
  // Push & SMS (Twilio)
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
};
