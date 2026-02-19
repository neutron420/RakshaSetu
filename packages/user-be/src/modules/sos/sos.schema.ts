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

export const addMediaSchema = z.object({
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
  url: z.string().url().max(2000),
  thumbnailUrl: z.string().url().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AddMediaInput = z.infer<typeof addMediaSchema>;
