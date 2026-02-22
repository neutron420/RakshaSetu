
-- Performance index for community feed sorting
CREATE INDEX IF NOT EXISTS "idx_incident_last_reported_desc" ON "Incident" ("lastReportedAt" DESC);

-- Performance index for media retrieval
CREATE INDEX IF NOT EXISTS "idx_sos_media_uploaded_at" ON "SosReportMedia" ("uploadedAt" ASC);
