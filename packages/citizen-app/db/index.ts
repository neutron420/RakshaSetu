import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { NativeModules } from "react-native";
import { IncidentRecord } from "./models/IncidentRecord";
import { ReliefCenterRecord } from "./models/ReliefCenterRecord";
import { offlineSchema } from "./schema";

const hasNativeBridge = Boolean((NativeModules as any)?.WMDatabaseBridge);
export const isWatermelonAvailable = hasNativeBridge;

let db: Database | null = null;

if (hasNativeBridge) {
  const adapter = new SQLiteAdapter({
    schema: offlineSchema,
    dbName: "rakshasetu_offline",
    onSetUpError: (error: unknown) => {
      console.error("[offline-db] WatermelonDB setup error:", error);
    },
  });

  db = new Database({
    adapter,
    modelClasses: [IncidentRecord, ReliefCenterRecord],
  });
} else {
  console.warn(
    "[offline-db] WatermelonDB native bridge not found. Running in fallback mode (likely Expo Go)."
  );
}

export const database = db;
