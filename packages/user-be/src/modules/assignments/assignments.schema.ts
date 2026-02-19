import { z } from "zod";

const assignmentStatusEnum = z.enum([
  "PENDING", "ACKNOWLEDGED", "EN_ROUTE", "ON_SITE", "COMPLETED", "CANCELED",
]);

export const createAssignmentSchema = z.object({
  teamId: z.string().uuid(),
  responderId: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
});

export const updateAssignmentStatusSchema = z.object({
  status: assignmentStatusEnum,
  note: z.string().max(2000).optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;
