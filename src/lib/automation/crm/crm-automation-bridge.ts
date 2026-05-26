/**
 * Pont CRM — enrichissement lead pour relances (sans écriture DB directe ici).
 */

import type { ConversationAutomationContext } from "../types";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

export type CrmAutomationLeadView = {
  displayName: string;
  contact: string | null;
  primaryNeed: string;
  pipelineStage: string;
  leadTemperature: string;
  lastInteraction: number;
};

export function toCrmLeadView(ctx: ConversationAutomationContext): CrmAutomationLeadView | null {
  const p: SmartProspectProfile | undefined = ctx.prospectLead;
  if (!p?.name?.trim()) return null;

  return {
    displayName: p.name.trim(),
    contact: p.email?.trim() || p.phone?.trim() || null,
    primaryNeed: p.primaryNeed?.trim() || "—",
    pipelineStage: ctx.pipelineStage ?? "new_lead",
    leadTemperature: ctx.leadTemperature ?? p.leadTemperature ?? "cold",
    lastInteraction: p.lastInteraction ?? Date.now(),
  };
}
