import { z } from "zod";

export const ReliefCenterTypeSchema = z.enum(["SHELTER", "HOSPITAL", "FOOD_CENTER", "OTHER"]);
export const ReliefCenterStatusSchema = z.enum(["OPEN", "FULL", "CLOSED", "INACTIVE"]);

export const createReliefCenterSchema = z.object({
  name: z.string().min(2).max(180),
  type: ReliefCenterTypeSchema.default("SHELTER"),
  status: ReliefCenterStatusSchema.default("OPEN"),
  description: z.string().optional(),
  address: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  contactPhone: z.string().max(20).optional(),
});

export const updateReliefCenterSchema = createReliefCenterSchema.partial();

export const nearbyCentersQuerySchema = z.object({
  latitude: z.string().transform(Number),
  longitude: z.string().transform(Number),
  radiusMeters: z.string().transform(Number).default("5000"),
});

export type CreateReliefCenterInput = z.infer<typeof createReliefCenterSchema>;
export type UpdateReliefCenterInput = z.infer<typeof updateReliefCenterSchema>;
