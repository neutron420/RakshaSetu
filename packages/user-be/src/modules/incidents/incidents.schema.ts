import { z } from "zod";

const sosCategoryEnum = z.enum([
  "FLOOD", "FIRE", "EARTHQUAKE", "ACCIDENT", "MEDICAL",
  "VIOLENCE", "LANDSLIDE", "CYCLONE", "OTHER",
]);

const incidentStatusEnum = z.enum([
  "OPEN", "INVESTIGATING", "IN_PROGRESS", "CONTAINED", "RESOLVED", "CLOSED",
]);

const incidentPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const createIncidentSchema = z.object({
  category: sosCategoryEnum,
  title: z.string().min(3).max(180),
  description: z.string().max(4000).optional(),
  priority: incidentPriorityEnum.optional().default("MEDIUM"),
  centroidLat: z.number().min(-90).max(90),
  centroidLng: z.number().min(-180).max(180),
  clusterRadiusMeters: z.number().int().min(100).max(50000).optional().default(1000),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  description: z.string().max(4000).optional(),
  status: incidentStatusEnum.optional(),
  priority: incidentPriorityEnum.optional(),
});

export const listIncidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: incidentStatusEnum.optional(),
  priority: incidentPriorityEnum.optional(),
  category: sosCategoryEnum.optional(),
});

export const linkReportSchema = z.object({
  reportId: z.string().uuid(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;
export type LinkReportInput = z.infer<typeof linkReportSchema>;
