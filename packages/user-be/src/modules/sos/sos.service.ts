import fs from "node:fs";
import { AppError } from "../../common/utils/app-error";
import { emitSosCreated } from "../../ws/events";
import { createSosReport, findByReporterAndClientReportId, listMyReports } from "./sos.repo";
import type { CreateSosInput } from "./sos.schema";
import { findNearbyIncident, linkReportToIncident } from "../incidents/incidents.repo";
import { create as createIncident } from "../incidents/incidents.service";
import { processSOSMessage } from "../../common/utils/ai-translator";

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

  // ── AI SOS Processing ───────────────────────────────────────────
  let aiResult = undefined;
  if (input.description && input.description.length > 5) {
      try {
          console.log(`[sos:submit] Sending description to AI translator...`);
          const aiResponse = await processSOSMessage(input.description);
          if (aiResponse) {
              aiResult = {
                  translatedText: aiResponse.translatedText,
                  severityScore: aiResponse.severityScore,
              };
              // Override category if AI is highly confident (optional, here we trust AI)
              if (aiResponse.emergencyType && aiResponse.emergencyType !== 'OTHER') {
                  input.category = aiResponse.emergencyType as any;
              }
          }
      } catch (err) {
          console.error(`[sos:submit] AI Processing failed, continuing without AI...`, err);
      }
  }

  const created = await createSosReport(reporterId, input, aiResult);
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
    let priority = "MEDIUM";
    if (aiResult?.severityScore) {
       if (aiResult.severityScore >= 8) priority = "CRITICAL";
       else if (aiResult.severityScore >= 6) priority = "HIGH";
       else if (aiResult.severityScore <= 3) priority = "LOW";
    }

    const newIncident = await createIncident({
      category: input.category,
      title: `${input.category.charAt(0) + input.category.slice(1).toLowerCase()} Reported`,
      description: aiResult?.translatedText || input.description || "Reported by citizen via SOS",
      priority: priority as any,
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
