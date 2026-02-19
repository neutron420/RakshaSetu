import { AppError } from "../../common/utils/app-error";
import {
  addMember as repoAddMember,
  createTeam as repoCreate,
  findMembership,
  findTeamById,
  findTeamByNameOrCode,
  listTeams as repoList,
  removeMember as repoRemove,
  updateMemberDuty as repoToggleDuty,
} from "./teams.repo";
import type { AddMemberInput, CreateTeamInput, ToggleDutyInput } from "./teams.schema";

export async function create(input: CreateTeamInput) {
  const existing = await findTeamByNameOrCode(input.name, input.code);
  if (existing) {
    throw new AppError("Team name or code already exists", 409);
  }
  return repoCreate(input);
}

export async function getById(id: string) {
  const team = await findTeamById(id);
  if (!team) {
    throw new AppError("Team not found", 404);
  }
  return team;
}

export async function list() {
  return repoList();
}

export async function addMember(teamId: string, input: AddMemberInput) {
  const team = await findTeamById(teamId);
  if (!team) {
    throw new AppError("Team not found", 404);
  }

  const existing = await findMembership(teamId, input.userId);
  if (existing) {
    throw new AppError("User is already a member of this team", 409);
  }

  return repoAddMember(teamId, input.userId);
}

export async function removeMember(teamId: string, userId: string) {
  const membership = await findMembership(teamId, userId);
  if (!membership) {
    throw new AppError("Membership not found", 404);
  }

  await repoRemove(teamId, userId);
  return { teamId, userId, removed: true };
}

export async function toggleDuty(teamId: string, userId: string, input: ToggleDutyInput) {
  const membership = await findMembership(teamId, userId);
  if (!membership) {
    throw new AppError("Membership not found", 404);
  }

  return repoToggleDuty(teamId, userId, input.isOnDuty);
}
