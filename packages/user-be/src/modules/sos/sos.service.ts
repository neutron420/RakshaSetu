import fs from "node:fs";
import { AppError } from "../../common/utils/app-error";
import { emitSosCreated } from "../../ws/events";
import { createSosReport, findByReporterAndClientReportId, listMyReports } from "./sos.repo";
import type { CreateSosInput } from "./sos.schema";
import { findNearbyIncident, linkReportToIncident } from "../incidents/incidents.repo";
import { create as createIncident } from "../incidents/incidents.service";

export async function submitSos(reporterId: string, input: CreateSosInput) {
  if (input.clientReportId) {
    const existing = await findByReporterAndClientReportId(reporterId, input.clientReportId);
    if (existing) {
      return {
        reportId: existing.id,
        status: existing.status,
        reportedAt: existing.reportedAt,
        duplicate: true,
      };
    }
  }

  const created = await createSosReport(reporterId, input);
  if (!created) {
    throw new AppError("Failed to create SOS report", 500);
  }

  emitSosCreated(reporterId, {
    reportId: created.id,
    category: input.category,
    latitude: input.latitude,
    longitude: input.longitude,
    reportedAt: created.reportedAt,
  });



  // ── Auto-Incident Linking ─────────────────────────────────────────
  try {
    const logBatch = (msg: string) => {
      console.log(msg);
      fs.appendFileSync("debug-sos.log", `${new Date().toISOString()} ${msg}\n`);
    };

    logBatch(`[sos:submit] Auto-linking report ${created.id} to incident...`);

    // Every report now creates its own incident (Clustering Disabled by User Request)
    console.log(`[sos:submit] Creating new incident for category ${input.category}...`);
    const newIncident = await createIncident({
      category: input.category,
      title: `${input.category.charAt(0) + input.category.slice(1).toLowerCase()} Reported`,
      description: input.description ?? "Reported by citizen via SOS",
      priority: "MEDIUM",
      centroidLat: input.latitude,
      centroidLng: input.longitude,
      clusterRadiusMeters: 0, // Disabled
    });
    console.log(`[sos:submit] Created new incident: ${newIncident.id}`);
    const targetIncidentId = newIncident.id;

    const { linkReport } = require("../incidents/incidents.service");
    await linkReport(targetIncidentId, { reportId: created.id });
    logBatch(`[sos:submit] Successfully linked report ${created.id} to incident ${targetIncidentId}`);

    // Trigger Proximity Alerts
    const { alertNearbyUsers } = require("./alerts.service");
    void alertNearbyUsers({
      incidentId: targetIncidentId,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
    });
  } catch (err: any) {
    const errMsg = `[sos:submit] CRITICAL: Auto-incident logic FAILED for report ${created.id}: ${err.message}`;
    console.error(errMsg);
    fs.appendFileSync("debug-sos.log", `${new Date().toISOString()} ${errMsg}\n${err.stack}\n`);
  }
  // ──────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────

  return {
    reportId: created.id,
    status: created.status,
    reportedAt: created.reportedAt,
    duplicate: false,
  };
}

export async function getMyReports(reporterId: string) {
  return listMyReports(reporterId);
}
