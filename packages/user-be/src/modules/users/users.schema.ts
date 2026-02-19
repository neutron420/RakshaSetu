import { z } from "zod";

export const updateMeSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().min(8).max(20).nullable().optional(),
    pushToken: z.string().optional(),
  })
  .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
    message: "At least one field is required",
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
