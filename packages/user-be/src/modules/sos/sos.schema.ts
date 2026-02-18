import { z } from "zod";

export const createSosSchema = z.object({
  category: z.enum([
    "FLOOD",
    "FIRE",
    "EARTHQUAKE",
    "ACCIDENT",
    "MEDICAL",
    "VIOLENCE",
    "LANDSLIDE",
    "CYCLONE",
    "OTHER",
  ]),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  clientReportId: z.string().max(64).optional(),
});

export type CreateSosInput = z.infer<typeof createSosSchema>;
