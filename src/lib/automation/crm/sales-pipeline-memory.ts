/**
 * Sales Pipeline Memory — position du prospect dans le tunnel commercial.
 */

import type { ConversationAutomationContext, SalesPipelineStage } from "../types";
import type { LeadTemperature } from "@/lib/prospect/lead-profile/prospect-profile";
import { analyzeTriggerSignals } from "../triggers/trigger-signals";

const STAGE_ORDER: SalesPipelineStage[] = [
  "social",
  "new_lead",
  "interested",
  "warm",
  "hot",
  "negotiating",
  "ready_to_buy",
  "customer",
  "lost",
];

function stageIndex(s: SalesPipelineStage): number {
  return STAGE_ORDER.indexOf(s);
}

function maxStage(a: SalesPipelineStage, b: SalesPipelineStage): SalesPipelineStage {
  return stageIndex(a) >= stageIndex(b) ? a : b;
}

export function temperatureToPipelineStage(temp: LeadTemperature): SalesPipelineStage {
  if (temp === "ready_to_buy") return "ready_to_buy";
  if (temp === "hot") return "hot";
  if (temp === "warm") return "warm";
  return "interested";
}

export function inferPipelineStage(ctx: ConversationAutomationContext): SalesPipelineStage {
  if (ctx.conversationState?.socialOnlyMode?.active === true) {
    return "social" as SalesPipelineStage;
  }

  const signals = analyzeTriggerSignals(ctx);
  const prev = ctx.pipelineStage ?? "new_lead";
  const temp = ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature ?? "cold";
  const turn = ctx.conversationState?.stats?.turn_count ?? 0;

  if (signals.complaint && /\b(pas\s+intéressé|laisse\s+tomber|stop)\b/i.test(ctx.lastUserMessage)) return "lost";
  if (signals.orderConfirmed) return "customer";
  if (signals.purchaseIntent) return maxStage(prev, "ready_to_buy");
  if (/\b(négoci|negoci|remise|discount)\b/i.test(ctx.lastUserMessage)) return maxStage(prev, "negotiating");
  if (signals.priceAsked && (temp === "hot" || temp === "warm")) return maxStage(prev, "negotiating");
  if (turn <= 1 && ctx.prospectLead?.name) return "new_lead";

  return maxStage(prev, temperatureToPipelineStage(temp));
}

export function formatPipelineMemoryBlock(stage: SalesPipelineStage, lang: "fr" | "en" | "es"): string {
  if (stage === "social") {
    if (lang === "en") return "SOCIAL MODE: human presence only — no sales push or automation urgency.";
    if (lang === "es") return "MODO SOCIAL: presencia humana — sin empuje comercial.";
    return "MODE SOCIAL : présence humaine — pas de pression vente ni relance commerciale.";
  }
  if (lang === "en") {
    return `SALES PIPELINE: prospect stage = ${stage}. Adapt tone and urgency to this stage only.`;
  }
  if (lang === "es") {
    return `PIPELINE COMERCIAL: etapa = ${stage}. Ajuste tono y urgencia solo a esta etapa.`;
  }
  return `PIPELINE COMMERCIAL : étape prospect = ${stage}. Adapter ton et urgence uniquement à cette étape.`;
}

export function pipelineAllowsCommercialFollowup(stage: SalesPipelineStage): boolean {
  return stage !== "lost" && stage !== "customer";
}
