import { z } from "zod";

export const updateMeSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().min(8).max(20).nullable().optional(),
    pushToken: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isVolunteer: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
