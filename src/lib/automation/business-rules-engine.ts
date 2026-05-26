/**
 * Règles métier déterministes — plafonds relances, horaires, VIP, panier, anti-spam.
 */

import { DateTime } from "luxon";
import type { AutomationIntentSignal } from "./automation-intent-engine";
import type { ConversationAutomationContext } from "./types";
import { canSendFollowup } from "./followups/anti-spam-human";
import { evaluateAutomationSafety } from "./automation-safety";
import type { ExecutionChannel } from "./execution-types";

export type BusinessRulesResult = {
  ok: boolean;
  reason?: string;
  /** Force file awaiting_human même si l’intent ne demande pas approval (ex. gros panier). */
  forceHumanApproval?: boolean;
  flags: string[];
};

const LARGE_BASKET_FCFA = 2_500_000;

function hourInBusinessTz(ctx: ConversationAutomationContext): number {
  const z = String(ctx.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const dt = DateTime.now().setZone(z);
  return dt.isValid ? dt.hour : 12;
}

function isVip(ctx: ConversationAutomationContext): boolean {
  const stage = ctx.pipelineStage ?? "interested";
  return stage === "ready_to_buy" || stage === "negotiating" || ctx.leadTemperature === "hot";
}

function isCold(ctx: ConversationAutomationContext): boolean {
  return (ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature ?? "warm") === "cold";
}

/**
 * Applique les règles avant enqueue / webhook.
 */
export function evaluateBusinessRules(args: {
  ctx: ConversationAutomationContext;
  intent: AutomationIntentSignal;
  channel: ExecutionChannel;
  idempotencyKey?: string;
  businessContext?: Record<string, unknown>;
}): BusinessRulesResult {
  const flags: string[] = [];
  const h = hourInBusinessTz(args.ctx);

  if (args.channel === "email" && (h >= 21 || h < 8)) {
    return { ok: false, reason: "email_curfew_21h_8h", flags: [...flags, "email_curfew"] };
  }

  if ((args.channel === "whatsapp" || args.channel === "sms") && (h >= 22 || h < 9)) {
    return { ok: false, reason: "whatsapp_night_curfew", flags: [...flags, "channel_night_block"] };
  }

  const rel = args.ctx.relanceCount ?? 0;
  if (!isVip(args.ctx) && rel >= 2 && args.intent.priority !== "high") {
    return { ok: false, reason: "max_relances_soft_cap_non_vip", flags: [...flags, "relance_cap_24h_style"] };
  }

  if (isCold(args.ctx) && args.intent.priority === "high" && args.intent.actionType === "SEND_WHATSAPP_FOLLOWUP") {
    flags.push("cold_whatsapp_softened");
  }

  const bc = args.businessContext ?? {};
  const bigBasket =
    Number(bc.cartTotalFcfa ?? bc.cartTotal ?? bc.orderTotal ?? 0) >= LARGE_BASKET_FCFA ||
    /\b(gros\s+panier|grosse\s+commande|montant\s+élevé)\b/i.test(args.ctx.lastUserMessage);

  if (bigBasket && args.intent.actionType !== "ESCALATE_TO_HUMAN") {
    flags.push("large_basket_human_review");
    return {
      ok: true,
      forceHumanApproval: true,
      flags,
    };
  }

  if (
    args.intent.actionType === "REQUEST_QUOTE_DETAILS" ||
    args.intent.actionType === "SCHEDULE_REMINDER"
  ) {
    const spam = canSendFollowup(args.ctx, "quotation_followup");
    if (!spam.allowed) {
      return { ok: false, reason: spam.reason, flags: [...flags, "anti_spam_followup"] };
    }
  }

  const safety = evaluateAutomationSafety({
    sessionId: args.ctx.sessionId,
    agentId: args.ctx.agentId,
    businessIanaTimezone: args.ctx.businessIanaTimezone,
    idempotencyKey: args.idempotencyKey,
    intent: args.intent,
  });

  if (!safety.ok) {
    return { ok: false, reason: safety.reason ?? "automation_safety", flags: [...flags, `safety_${safety.reason}`] };
  }

  if (isVip(args.ctx)) flags.push("vip_relax");

  return { ok: true, flags };
}
