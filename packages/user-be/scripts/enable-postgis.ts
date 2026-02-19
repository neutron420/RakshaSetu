import { prisma } from "../src/common/db/prisma";

async function main() {
  console.log("Enabling PostGIS extension...");
  try {
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis;");
    console.log("✅ PostGIS extension enabled.");
  } catch (error) {
    console.error("❌ Failed to enable PostGIS:", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
