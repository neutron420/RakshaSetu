import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { UserRole } from "../../../../../prisma/generated/prisma";
import { AppError } from "../../common/utils/app-error";
import { env } from "../../config/env";
import { createCitizenUser, findUserByEmail } from "./auth.repo";
import type { LoginInput, SignupInput } from "./auth.schema";

function issueAccessToken(payload: { id: string; email: string; role: UserRole }) {
  const options: SignOptions = {
    subject: payload.id,
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ email: payload.email, role: payload.role }, env.jwtSecret, options);
}

export async function signup(input: SignupInput) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await createCitizenUser(input, passwordHash);

  const accessToken = issueAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    },
    accessToken,
    tokenType: "Bearer",
  };
}

export async function login(input: LoginInput) {
  const user = await findUserByEmail(input.email);
  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken = issueAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    },
    accessToken,
    tokenType: "Bearer",
  };
}
