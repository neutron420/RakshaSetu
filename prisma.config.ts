import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(projectRoot, ".env") });

export default defineConfig({
  schema: path.join(projectRoot, "prisma/schema.prisma"),
  migrations: {
    path: path.join(projectRoot, "prisma/migrations"),
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
