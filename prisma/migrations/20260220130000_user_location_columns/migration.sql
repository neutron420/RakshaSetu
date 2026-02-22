-- AlterTable: Add location columns to User (for last known position)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLat" DECIMAL(9,6);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLng" DECIMAL(9,6);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLocationGeo" geography(Point, 4326);
