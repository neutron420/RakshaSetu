import { prisma } from "../../common/db/prisma";
import type { UpdateMeInput } from "./users.schema";

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserById(id: string, input: UpdateMeInput) {
  const { fullName, phone, pushToken, latitude, longitude, isVolunteer, skills } = input;

  const rows = await prisma.$queryRaw<any[]>`
    UPDATE "User"
    SET
      "fullName" = COALESCE(${fullName ?? null}, "fullName"),
      "phone"    = CASE 
                     WHEN ${phone === null} THEN NULL 
                     WHEN ${phone !== undefined} THEN ${phone} 
                     ELSE "phone" 
                   END,
      "pushToken" = COALESCE(${pushToken ?? null}, "pushToken"),
      "lastLat"   = COALESCE(${latitude ?? null}, "lastLat"),
      "lastLng"   = COALESCE(${longitude ?? null}, "lastLng"),
      "lastLocationGeo" = CASE
                            WHEN ${latitude !== undefined && longitude !== undefined} 
                            THEN ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                            ELSE "lastLocationGeo"
                          END,
      "isVolunteer" = CASE
                        WHEN ${isVolunteer !== undefined} THEN ${isVolunteer}
                        ELSE "isVolunteer"
                      END,
      "skills" = CASE
                   WHEN ${skills !== undefined} THEN ${skills}::"VolunteerSkill"[]
                   ELSE "skills"
                 END,
      "updatedAt" = NOW()
    WHERE "id" = ${id}::uuid
    RETURNING *
  `;

  return rows[0];
}
