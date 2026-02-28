import { Request, Response } from "express";
import { prisma } from "../../common/db/prisma";
import { z } from "zod";
import { broadcast } from "../../ws";

const dispatchResponseSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  note: z.string().optional(),
});

export async function handleDispatchResponse(req: Request, res: Response) {
  try {
    const incidentId = req.params.incidentId as string;
    const userId = req.user?.id; // Assuming auth middleware sets this
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parseResult = dispatchResponseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, errors: parseResult.error.errors });
    }

    const { status, note } = parseResult.data;

    // Check if incident exists and is still open
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      return res.status(404).json({ success: false, message: "Incident not found" });
    }

    if (incident.status === 'RESOLVED' || incident.status === 'CLOSED') {
      return res.status(400).json({ success: false, message: "Incident is already resolved or closed" });
    }

    if (status === "ACCEPTED") {
      
      // Let's check if they are already assigned
      const existingAssignment = await prisma.incidentAssignment.findFirst({
        where: { incidentId, responderId: userId }
      });

      if (existingAssignment) {
        return res.status(400).json({ success: false, message: "You are already assigned to this incident" });
      }

      // Check for a default volunteer team, or create one if it doesn't exist
      let volunteerTeam = await prisma.rescueTeam.findUnique({ where: { name: "Community Volunteers" } });
      if (!volunteerTeam) {
          volunteerTeam = await prisma.rescueTeam.create({
              data: {
                  name: "Community Volunteers",
                  code: "VOL-001",
                  isActive: true
              }
          });
      }

      const assignment = await prisma.incidentAssignment.create({
        data: {
          incidentId,
          teamId: volunteerTeam.id,
          responderId: userId,
          assignedById: userId, // Self-assigned
          status: "ACKNOWLEDGED",
          note: note || "Accepted dispatch request",
          acknowledgedAt: new Date()
        }
      });

      // Emit a WebSocket event so the victim sees someone accepted
      broadcast({
        type: "DISPATCH_ACCEPTED",
        payload: {
          incidentId,
          responderId: userId
        }
      });

      return res.status(200).json({ success: true, message: "Dispatch accepted successfully", data: assignment });
    } else {
      return res.status(200).json({ success: true, message: "Dispatch declined successfully" });
    }

  } catch (err: any) {
    console.error("[dispatch-controller] Error handling dispatch response:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
