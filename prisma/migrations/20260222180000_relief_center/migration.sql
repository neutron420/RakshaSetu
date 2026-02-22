-- CreateEnum
CREATE TYPE "ReliefCenterType" AS ENUM ('SHELTER', 'HOSPITAL', 'FOOD_CENTER', 'OTHER');

-- CreateEnum
CREATE TYPE "ReliefCenterStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED', 'INACTIVE');

-- CreateTable
CREATE TABLE "ReliefCenter" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "type" "ReliefCenterType" NOT NULL DEFAULT 'SHELTER',
    "status" "ReliefCenterStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "address" TEXT,
    "maxCapacity" INTEGER,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "locationGeo" geography(Point, 4326) NOT NULL,
    "contactPhone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ReliefCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_relief_center_type" ON "ReliefCenter"("type");
CREATE INDEX "idx_relief_center_status" ON "ReliefCenter"("status");
