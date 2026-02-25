import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../common/db/prisma';
import z from 'zod';
import { authMiddleware } from '../../common/middleware/auth.middleware';

export const bleRelayRouter = Router();

const bleRelaySchema = z.object({
  victimId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  originalTimestamp: z.number(),
  meshProtocol: z.string()
});

bleRelayRouter.post('/ble-relay', authMiddleware, async (req, res) => {
  try {
    const payload = bleRelaySchema.parse(req.body);
    const saviorId = (req as any).user?.id;

    if (!saviorId) {
      return res.status(401).json({ error: 'Relay savior unauthorized' });
    }

    console.log(
      `[BLE RELAY] Intercepted offline SOS from Victim ${payload.victimId}, relayed by Savior ${saviorId}.`
    );

    const reportId = randomUUID();
    const description = `⚠️ OFFLINE BEACON DETECTED ⚠️\n\nThis offline citizen was located via RakshaSetu Mesh Network.\nRelayed by nearby user.\nOriginal Ping: ${new Date(payload.originalTimestamp).toISOString()}`;

    // Use raw SQL because locationGeo is a PostGIS Unsupported type
    const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "SosReport" (
        "id",
        "reporterId",
        "category",
        "status",
        "description",
        "latitude",
        "longitude",
        "locationGeo",
        "source",
        "reportedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${reportId}::uuid,
        ${payload.victimId}::uuid,
        'OTHER'::"SosCategory",
        'RECEIVED'::"SosReportStatus",
        ${description},
        ${payload.latitude},
        ${payload.longitude},
        ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography,
        'ble_mesh_relay',
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING "id"::text AS "id"
    `;

    const report = inserted[0];

    await prisma.eventOutboxMessage.create({
      data: {
        partitionKey: report.id,
        aggregateId: report.id,
        aggregateType: 'SOSReport',
        eventType: 'EMERGENCY_ALERT',
        payload: {
            reportId: report.id,
            victimId: payload.victimId,
            category: 'OTHER',
            latitude: payload.latitude,
            longitude: payload.longitude,
            source: 'BLE_MESH_RELAY',
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Relay successfully accepted and dispatched into alert stream.',
      reportId: report.id
    });

  } catch (err: any) {
    console.error('[BLE RELAY] Error processing offline payload', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid BLE Payload', details: err.errors });
    }
    return res.status(500).json({ error: 'Internal Server Error during Relay' });
  }
});
