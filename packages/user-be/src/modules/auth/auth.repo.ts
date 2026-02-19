import { prisma } from "../../common/db/prisma";
import type { SignupInput } from "./auth.schema";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } });
}

export async function upsertUserByPhone(phone: string, otpCode: string, otpExpiresAt: Date) {
  return prisma.user.upsert({
    where: { phone },
    update: { otpCode, otpExpiresAt },
    create: {
      phone,
      otpCode,
      otpExpiresAt,
      fullName: "Citizen",
      role: "CITIZEN",
    },
  });
}

export async function clearOtp(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { otpCode: null, otpExpiresAt: null },
  });
}

export async function createCitizenUser(input: SignupInput, passwordHash: string) {
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      role: "CITIZEN",
    },
  });
}
