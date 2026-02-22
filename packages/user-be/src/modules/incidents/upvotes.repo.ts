import { randomUUID } from "node:crypto";
import { prisma } from "../../common/db/prisma";

export interface UpvoteCountRow {
  incidentId: string;
  count: number;
  userVoted: boolean;
}

/**
 * Toggle upvote: if user already upvoted, remove it; otherwise, add it.
 * Returns the new upvote state.
 */
export async function toggleUpvote(incidentId: string, userId: string) {
  // Check if the user already upvoted
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"::text AS "id"
    FROM "IncidentUpvote"
    WHERE "incidentId" = ${incidentId}::uuid
      AND "userId" = ${userId}::uuid
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Remove the upvote
    await prisma.$queryRaw`
      DELETE FROM "IncidentUpvote"
      WHERE "id" = ${existing[0].id}::uuid
    `;
    return { voted: false };
  } else {
    // Add the upvote
    const id = randomUUID();
    await prisma.$queryRaw`
      INSERT INTO "IncidentUpvote" ("id", "incidentId", "userId", "createdAt")
      VALUES (${id}::uuid, ${incidentId}::uuid, ${userId}::uuid, NOW())
    `;
    return { voted: true };
  }
}

/**
 * Get upvote count for a single incident + whether the current user voted.
 */
export async function getUpvoteInfo(incidentId: string, userId: string) {
  const rows = await prisma.$queryRaw<{ count: bigint; userVoted: boolean }[]>`
    SELECT
      COUNT(*)::bigint AS "count",
      BOOL_OR("userId" = ${userId}::uuid) AS "userVoted"
    FROM "IncidentUpvote"
    WHERE "incidentId" = ${incidentId}::uuid
  `;

  const row = rows[0];
  return {
    incidentId,
    count: Number(row?.count ?? 0),
    userVoted: row?.userVoted ?? false,
  };
}

/**
 * Get upvote counts for multiple incidents (batch) + whether the current user voted each.
 */
export async function getUpvotesForIncidents(incidentIds: string[], userId: string) {
  if (incidentIds.length === 0) return [];

  const rows = await prisma.$queryRaw<{ incidentId: string; count: bigint; userVoted: boolean }[]>`
    SELECT
      iu."incidentId"::text AS "incidentId",
      COUNT(*)::bigint AS "count",
      BOOL_OR(iu."userId" = ${userId}::uuid) AS "userVoted"
    FROM "IncidentUpvote" iu
    WHERE iu."incidentId" = ANY(${incidentIds}::uuid[])
    GROUP BY iu."incidentId"
  `;

  // Build a map and fill in missing incidents with 0
  const map = new Map(rows.map((r) => [r.incidentId, { count: Number(r.count), userVoted: r.userVoted }]));

  return incidentIds.map((id) => ({
    incidentId: id,
    count: map.get(id)?.count ?? 0,
    userVoted: map.get(id)?.userVoted ?? false,
  }));
}
