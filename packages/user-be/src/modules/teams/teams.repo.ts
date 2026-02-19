import { prisma } from "../../common/db/prisma";
import type { CreateTeamInput } from "./teams.schema";

export async function createTeam(input: CreateTeamInput) {
  return prisma.rescueTeam.create({
    data: {
      name: input.name,
      code: input.code,
      leadUserId: input.leadUserId ?? null,
    },
    select: {
      id: true,
      name: true,
      code: true,
      leadUserId: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function findTeamById(id: string) {
  return prisma.rescueTeam.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      leadUserId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lead: { select: { id: true, fullName: true, email: true } },
      members: {
        select: {
          id: true,
          userId: true,
          isOnDuty: true,
          joinedAt: true,
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
}

export async function listTeams() {
  return prisma.rescueTeam.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      leadUserId: true,
      isActive: true,
      createdAt: true,
      lead: { select: { id: true, fullName: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function addMember(teamId: string, userId: string) {
  return prisma.teamMember.create({
    data: { teamId, userId },
    select: {
      id: true,
      teamId: true,
      userId: true,
      isOnDuty: true,
      joinedAt: true,
    },
  });
}

export async function removeMember(teamId: string, userId: string) {
  return prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function updateMemberDuty(teamId: string, userId: string, isOnDuty: boolean) {
  return prisma.teamMember.update({
    where: { teamId_userId: { teamId, userId } },
    data: { isOnDuty },
    select: {
      id: true,
      teamId: true,
      userId: true,
      isOnDuty: true,
      joinedAt: true,
    },
  });
}

export async function findMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function findTeamByNameOrCode(name: string, code: string) {
  return prisma.rescueTeam.findFirst({
    where: { OR: [{ name }, { code }] },
    select: { id: true },
  });
}
