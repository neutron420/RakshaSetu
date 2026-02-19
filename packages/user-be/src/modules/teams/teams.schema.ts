import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(40),
  leadUserId: z.string().uuid().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const toggleDutySchema = z.object({
  isOnDuty: z.boolean(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const teamMemberParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type ToggleDutyInput = z.infer<typeof toggleDutySchema>;
