-- AlterTable: User.email nullable (OTP-only users have no email)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: Add OTP and push token columns for User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushToken" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpCode" VARCHAR(6);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMPTZ(6);
