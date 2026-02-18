import { AppError } from "../../common/utils/app-error";
import { findUserById, updateUserById } from "./users.repo";
import type { UpdateMeInput } from "./users.schema";

function toProfile(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getMyProfile(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return toProfile(user);
}

export async function updateMyProfile(userId: string, input: UpdateMeInput) {
  const user = await updateUserById(userId, input);
  return toProfile(user);
}
