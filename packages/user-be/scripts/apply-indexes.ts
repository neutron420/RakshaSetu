
import { prisma } from "../src/common/db/prisma";
import fs from "node:fs";
import path from "node:path";

async function applyIndexes() {
  const sqlFiles = ["add-indexes.sql", "add-spatial-index.sql"];
  
  for (const file of sqlFiles) {
    console.log(`Reading ${file}...`);
    const sqlPath = path.join(__dirname, file);
    if (!fs.existsSync(sqlPath)) continue;
    
    const sql = fs.readFileSync(sqlPath, "utf8");
    const commands = sql.split(";").filter(c => c.trim().length > 0);
    
    for (const cmd of commands) {
      console.log(`Executing in ${file}: ${cmd.trim().substring(0, 50)}...`);
      await prisma.$executeRawUnsafe(cmd);
    }
  }
  console.log("Indexes applied successfully!");
}

applyIndexes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
