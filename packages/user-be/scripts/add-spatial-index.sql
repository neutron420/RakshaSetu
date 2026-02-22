-- Spatial index for fast proximity lookups (auto-linking)
CREATE INDEX IF NOT EXISTS "idx_incident_centroid_geo_gist" ON "Incident" USING GIST ("centroidGeo");

-- Spatial index for finding nearby users (Alert King)
CREATE INDEX IF NOT EXISTS "idx_user_last_location_geo_gist" ON "User" USING GIST ("lastLocationGeo");
