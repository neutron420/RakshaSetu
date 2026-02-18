import { prisma } from "../../common/db/prisma";
import type { SignupInput } from "./auth.schema";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
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
