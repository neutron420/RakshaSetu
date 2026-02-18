CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'ADMIN', 'RESPONDER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SosCategory" AS ENUM ('FLOOD', 'FIRE', 'EARTHQUAKE', 'ACCIDENT', 'MEDICAL', 'VIOLENCE', 'LANDSLIDE', 'CYCLONE', 'OTHER');

-- CreateEnum
CREATE TYPE "SosReportStatus" AS ENUM ('RECEIVED', 'TRIAGED', 'LINKED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "EventPublishStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "passwordHash" VARCHAR(255),
    "fullName" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueTeam" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "leadUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RescueTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOnDuty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "category" "SosCategory" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 1,
    "confidenceScore" DECIMAL(5,2),
    "clusterRadiusMeters" INTEGER NOT NULL DEFAULT 1000,
    "centroidLat" DECIMAL(9,6) NOT NULL,
    "centroidLng" DECIMAL(9,6) NOT NULL,
    "centroidGeo" geography(Point, 4326) NOT NULL,
    "firstReportedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastReportedAt" TIMESTAMPTZ(6) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosReport" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "incidentId" UUID,
    "category" "SosCategory" NOT NULL,
    "status" "SosReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "severity" SMALLINT,
    "source" VARCHAR(32) NOT NULL DEFAULT 'mobile',
    "clientReportId" VARCHAR(64),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracyMeters" DECIMAL(10,2),
    "locationGeo" geography(Point, 4326) NOT NULL,
    "happenedAt" TIMESTAMPTZ(6),
    "reportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SosReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosReportMedia" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "metadata" JSONB,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosReportMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAssignment" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "responderId" UUID,
    "assignedById" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(6),
    "arrivedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IncidentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentStatusEvent" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "actorUserId" UUID,
    "previousStatus" "IncidentStatus",
    "newStatus" "IncidentStatus" NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'system',
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOutboxMessage" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(50) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "partitionKey" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "publishStatus" "EventPublishStatus" NOT NULL DEFAULT 'PENDING',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),
    "errorMessage" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "RescueTeam_name_key" ON "RescueTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RescueTeam_code_key" ON "RescueTeam"("code");

-- CreateIndex
CREATE INDEX "idx_rescue_team_lead" ON "RescueTeam"("leadUserId");

-- CreateIndex
CREATE INDEX "idx_team_member_user" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ux_team_member" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "idx_incident_category_status" ON "Incident"("category", "status");

-- CreateIndex
CREATE INDEX "idx_incident_queue" ON "Incident"("status", "priority", "lastReportedAt");

-- CreateIndex
CREATE INDEX "idx_incident_first_reported" ON "Incident"("firstReportedAt");

-- CreateIndex
CREATE INDEX "idx_sos_report_incident_time" ON "SosReport"("incidentId", "reportedAt");

-- CreateIndex
CREATE INDEX "idx_sos_report_reporter_time" ON "SosReport"("reporterId", "reportedAt");

-- CreateIndex
CREATE INDEX "idx_sos_report_category_status" ON "SosReport"("category", "status");

-- CreateIndex
CREATE INDEX "idx_sos_report_verification" ON "SosReport"("verificationStatus", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sos_report_idempotency" ON "SosReport"("reporterId", "clientReportId");

-- CreateIndex
CREATE INDEX "idx_sos_media_report" ON "SosReportMedia"("reportId");

-- CreateIndex
CREATE INDEX "idx_incident_assignment_status" ON "IncidentAssignment"("incidentId", "status");

-- CreateIndex
CREATE INDEX "idx_team_assignment_status" ON "IncidentAssignment"("teamId", "status");

-- CreateIndex
CREATE INDEX "idx_responder_assignment_status" ON "IncidentAssignment"("responderId", "status");

-- CreateIndex
CREATE INDEX "idx_incident_status_event_stream" ON "IncidentStatusEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_incident_status_event_created" ON "IncidentStatusEvent"("createdAt");

-- CreateIndex
CREATE INDEX "idx_outbox_dispatch" ON "EventOutboxMessage"("publishStatus", "availableAt");

-- CreateIndex
CREATE INDEX "idx_outbox_aggregate" ON "EventOutboxMessage"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "idx_outbox_created" ON "EventOutboxMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "RescueTeam" ADD CONSTRAINT "RescueTeam_leadUserId_fkey" FOREIGN KEY ("leadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "RescueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReportMedia" ADD CONSTRAINT "SosReportMedia_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SosReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "RescueTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStatusEvent" ADD CONSTRAINT "IncidentStatusEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStatusEvent" ADD CONSTRAINT "IncidentStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOutboxMessage" ADD CONSTRAINT "EventOutboxMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
