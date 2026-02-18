import { prisma } from "../../common/db/prisma";
import type { UpdateMeInput } from "./users.schema";

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserById(id: string, input: UpdateMeInput) {
  return prisma.user.update({
    where: { id },
    data: {
      fullName: input.fullName,
      phone: input.phone === null ? null : input.phone,
    },
  });
}
