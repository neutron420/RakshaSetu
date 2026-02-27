import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const offlineSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "incidents",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "category", type: "string" },
        { name: "status", type: "string" },
        { name: "priority", type: "string" },
        { name: "severity", type: "string", isOptional: true },
        { name: "title", type: "string" },
        { name: "description", type: "string", isOptional: true },
        { name: "centroid_lat", type: "number", isIndexed: true },
        { name: "centroid_lng", type: "number", isIndexed: true },
        { name: "cluster_radius_meters", type: "number" },
        { name: "report_count", type: "number" },
        { name: "representative_media_url", type: "string", isOptional: true },
        { name: "confidence_score", type: "number", isOptional: true },
        { name: "first_reported_at", type: "number" },
        { name: "last_reported_at", type: "number", isIndexed: true },
        { name: "resolved_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number", isIndexed: true },
      ],
    }),
    tableSchema({
      name: "relief_centers",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "name", type: "string" },
        { name: "type", type: "string", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "description", type: "string", isOptional: true },
        { name: "address", type: "string", isOptional: true },
        { name: "max_capacity", type: "number", isOptional: true },
        { name: "current_count", type: "number" },
        { name: "latitude", type: "number", isIndexed: true },
        { name: "longitude", type: "number", isIndexed: true },
        { name: "contact_phone", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number", isIndexed: true },
      ],
    }),
  ],
});
