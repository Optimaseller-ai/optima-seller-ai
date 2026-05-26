/**
 * Smart Automation Rate Limiter — anti-spam, anti-duplication, anti-répétition.
 */

import "server-only";

import { logAutomation } from "../event-log";
import { resolveStableConversationId } from "../payloads/n8n-production-payload";
import type { ConversationAutomationContext } from "../types";
import type { AutomationEventName } from "../types";

import {
  computeCooldownUntilIso,
  isWorkflowCooldownMs,
  normalizeLeadTemperature,
  remainingCooldownMs,
  resolveCooldownMs,
  type AutomationActionChannel,
} from "./cooldown-engine";
import {
  findRecentAutomationHistory,
  getActiveCooldownForConversation,
  insertAutomationHistory,
  logBlockedAutomationForSupervision,
  type AutomationHistoryStatus,
} from "./automation-history";

export type CanExecuteAutomationResult = {
  allowed: boolean;
  reason?: string;
  remainingCooldownMs?: number;
  cooldownUntil?: string;
};

export type AutomationRateLimitInput = {
  prospectId: string;
  conversationId: string;
  sessionId: string;
  agentId: string;
  actionType: string;
  actionChannel: AutomationActionChannel;
  leadTemperature?: string | null;
  workflowSlug?: string;
  event?: AutomationEventName | string;
  /** Si true, enregistre un blocage en historique (évite re-tentatives). */
  recordBlock?: boolean;
};

function eventToActionType(event: string, channel: AutomationActionChannel): string {
  if (event === "lead.hot") return "HOT_PROSPECT_ALERT";
  if (event === "followup.required") {
    return channel === "whatsapp" ? "SEND_WHATSAPP_FOLLOWUP" : channel === "email" ? "SEND_PRODUCT_EMAIL" : "FOLLOWUP";
  }
  if (event === "email.collected") return "SEND_PRODUCT_EMAIL";
  if (event === "quote.requested") return "REQUEST_QUOTE_DETAILS";
  if (event === "purchase.intent") return "CREATE_ORDER_DRAFT";
  return event.replace(/\./g, "_").toUpperCase();
}

export function resolveActionChannelFromEvent(
  event: string,
  hint?: string,
): AutomationActionChannel {
  const h = String(hint ?? "").toLowerCase();
  if (h === "whatsapp") return "whatsapp";
  if (h === "email") return "email";
  if (event === "lead.hot" || event.includes("order") || event.includes("payment")) return "workflow";
  if (event === "followup.required") return "multi";
  if (event === "message.received") return "chat";
  return "workflow";
}

export function inputFromAutomationContext(
  ctx: ConversationAutomationContext,
  args: {
    actionType?: string;
    actionChannel?: AutomationActionChannel;
    event?: AutomationEventName | string;
    workflowSlug?: string;
  },
): AutomationRateLimitInput {
  const conversationId = resolveStableConversationId(ctx);
  const channel =
    args.actionChannel ??
    resolveActionChannelFromEvent(String(args.event ?? ""), ctx.prospectLead?.email ? "email" : undefined);
  const actionType =
    args.actionType ?? eventToActionType(String(args.event ?? "automation"), channel);

  return {
    prospectId: str(ctx.userId),
    conversationId,
    sessionId: str(ctx.sessionId),
    agentId: str(ctx.agentId),
    actionType,
    actionChannel: channel,
    leadTemperature: ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature,
    workflowSlug: args.workflowSlug,
    event: args.event,
    recordBlock: true,
  };
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Vérifie si une automation peut partir (email, relance, workflow n8n).
 */
export async function canExecuteAutomationAction(
  input: AutomationRateLimitInput,
): Promise<CanExecuteAutomationResult> {
  const conversationId = str(input.conversationId);
  if (!conversationId) {
    return { allowed: false, reason: "missing_conversation_id" };
  }

  const temp = normalizeLeadTemperature(input.leadTemperature);
  const cooldownMs = resolveCooldownMs({
    leadTemperature: temp,
    actionChannel: input.actionChannel,
    actionType: input.actionType,
  });

  const active = await getActiveCooldownForConversation(conversationId);
  if (active) {
    const remaining = remainingCooldownMs(active.cooldownUntil);
    if (remaining > 0) {
      const reason = `cooldown_active_${active.actionType}`;
      if (input.recordBlock !== false) {
        await recordBlockedAction(input, reason, active.cooldownUntil);
      }
      return {
        allowed: false,
        reason,
        remainingCooldownMs: remaining,
        cooldownUntil: active.cooldownUntil,
      };
    }
  }

  const sinceIso = new Date(Date.now() - cooldownMs).toISOString();
  const recentSame = await findRecentAutomationHistory({
    conversationId,
    actionType: input.actionType,
    actionChannel: input.actionChannel,
    sinceIso,
    limit: 3,
  });

  const lastExecuted = recentSame.find((r) => r.status === "executed");
  if (lastExecuted) {
    const remaining = remainingCooldownMs(lastExecuted.cooldownUntil);
    if (remaining > 0) {
      const reason = `same_action_cooldown_${input.actionType}`;
      if (input.recordBlock !== false) {
        await recordBlockedAction(input, reason, lastExecuted.cooldownUntil);
      }
      return {
        allowed: false,
        reason,
        remainingCooldownMs: remaining,
        cooldownUntil: lastExecuted.cooldownUntil,
      };
    }
  }

  if (input.workflowSlug) {
    const wfSince = new Date(Date.now() - isWorkflowCooldownMs()).toISOString();
    const recentWf = await findRecentAutomationHistory({
      conversationId,
      workflowSlug: input.workflowSlug,
      sinceIso: wfSince,
      limit: 2,
    });
    const wfHit = recentWf.find((r) => r.status === "executed");
    if (wfHit) {
      const reason = `workflow_duplicate_${input.workflowSlug}`;
      if (input.recordBlock !== false) {
        await recordBlockedAction(input, reason, wfHit.cooldownUntil);
      }
      return {
        allowed: false,
        reason,
        remainingCooldownMs: remainingCooldownMs(wfHit.cooldownUntil),
        cooldownUntil: wfHit.cooldownUntil,
      };
    }
  }

  if (input.actionChannel === "email" || input.actionType.includes("EMAIL")) {
    const emailSince = new Date(Date.now() - cooldownMs).toISOString();
    const recentEmail = await findRecentAutomationHistory({
      conversationId,
      actionChannel: "email",
      sinceIso: emailSince,
      limit: 2,
    });
    if (recentEmail.some((r) => r.status === "executed")) {
      const hit = recentEmail[0]!;
      const reason = "email_recently_sent";
      if (input.recordBlock !== false) {
        await recordBlockedAction(input, reason, hit.cooldownUntil);
      }
      return {
        allowed: false,
        reason,
        remainingCooldownMs: remainingCooldownMs(hit.cooldownUntil),
        cooldownUntil: hit.cooldownUntil,
      };
    }
  }

  if (
    (temp === "hot" || temp === "ready_to_buy") &&
    (input.event === "message.received" || input.actionType === "MESSAGE_RECEIVED")
  ) {
    return { allowed: false, reason: "hot_prospect_no_per_message_bus" };
  }

  return { allowed: true };
}

async function recordBlockedAction(
  input: AutomationRateLimitInput,
  reason: string,
  cooldownUntil?: string,
) {
  const until =
    cooldownUntil ??
    computeCooldownUntilIso(
      Date.now(),
      resolveCooldownMs({
        leadTemperature: input.leadTemperature,
        actionChannel: input.actionChannel,
        actionType: input.actionType,
      }),
    );

  logBlockedAutomationForSupervision({
    conversationId: input.conversationId,
    sessionId: input.sessionId,
    reason,
    actionType: input.actionType,
    cooldownUntil: until,
  });

  await insertAutomationHistory({
    prospectId: input.prospectId,
    conversationId: input.conversationId,
    agentId: input.agentId,
    sessionId: input.sessionId,
    actionType: input.actionType,
    actionChannel: input.actionChannel,
    executedAt: new Date().toISOString(),
    cooldownUntil: until,
    status: "blocked",
    metadata: { reason, workflowSlug: input.workflowSlug, event: input.event },
  });

  logAutomation({
    level: "info",
    event: (input.event as AutomationEventName) ?? "followup.required",
    message: "automation_rate_limit_blocked",
    agentId: input.agentId,
    sessionId: input.sessionId,
    meta: { reason, actionType: input.actionType, cooldownUntil: until },
  });
}

/** Enregistre une exécution réussie (après envoi n8n OK). */
export async function recordAutomationExecution(input: AutomationRateLimitInput): Promise<void> {
  const cooldownMs = resolveCooldownMs({
    leadTemperature: input.leadTemperature,
    actionChannel: input.actionChannel,
    actionType: input.actionType,
  });
  const now = Date.now();
  const cooldownUntil = computeCooldownUntilIso(now, cooldownMs);

  await insertAutomationHistory({
    prospectId: input.prospectId,
    conversationId: input.conversationId,
    agentId: input.agentId,
    sessionId: input.sessionId,
    actionType: input.actionType,
    actionChannel: input.actionChannel,
    executedAt: new Date(now).toISOString(),
    cooldownUntil,
    status: "executed" satisfies AutomationHistoryStatus,
    metadata: {
      workflowSlug: input.workflowSlug,
      event: input.event,
      leadTemperature: input.leadTemperature,
    },
  });
}

/** @deprecated — utiliser canExecuteAutomationAction */
export async function checkAutomationRateLimit(args: {
  sessionId: string;
  agentId: string;
  channel: "email" | "whatsapp" | "automation" | "any";
}): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const channelMap: Record<string, AutomationActionChannel> = {
    email: "email",
    whatsapp: "whatsapp",
    automation: "workflow",
    any: "multi",
  };
  const out = await canExecuteAutomationAction({
    prospectId: args.sessionId,
    conversationId: `optima_conv_${args.agentId}_${args.sessionId}`,
    sessionId: args.sessionId,
    agentId: args.agentId,
    actionType: "AUTOMATION",
    actionChannel: channelMap[args.channel] ?? "multi",
    recordBlock: false,
  });
  if (out.allowed) return { allowed: true };
  return { allowed: false, reason: out.reason ?? "rate_limited" };
}
