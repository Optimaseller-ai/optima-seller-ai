/**
 * Couche de décision autonome — avant toute automation sortante.
 * États : ALLOW · DELAY · SOFT_ACTION · BLOCK (+ explications supervision).
 */

import "server-only";

import { DateTime } from "luxon";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import type { AutomationIntentSignal, AutomationActionType } from "./automation-intent-engine";
import { computeLeadPriorityScore } from "./automation-priority-engine";
import {
  evaluateBusinessHoursForOutbound,
  isOutboundAutomationAction,
  nextBusinessWindowStartIso,
  resolveBusinessHoursConfig,
} from "./business-hours-guard";
import { detectFollowupFatigue } from "./followup-fatigue-detector";
import { analyzeTriggerSignals } from "./triggers/trigger-signals";
import type { AutomationTriggerKind, ConversationAutomationContext } from "./types";
import type { ExecutionChannel } from "./execution-types";

export type AutonomousDecisionState = "ALLOW" | "DELAY" | "SOFT_ACTION" | "BLOCK";

export type AutonomousDecisionInput = {
  ctx: ConversationAutomationContext;
  intent?: AutomationIntentSignal | null;
  routedChannel?: ExecutionChannel;
  trigger?: AutomationTriggerKind | null;
  /** Relance autonome sans nouveau message prospect. */
  isAutonomousFollowup?: boolean;
};

export type AutonomousDecisionResult = {
  state: AutonomousDecisionState;
  /** Explications lisibles admin / logs. */
  reasons: string[];
  factors: Record<string, string | number | boolean>;
  resumeAt?: string;
  toneHint?: "human_soft" | "neutral" | "accelerate";
};

const SILENCE_BEFORE_FOLLOWUP_MS = 2 * 60 * 60 * 1000;

const AGGRESSIVE_ACTIONS = new Set<AutomationActionType>([
  "CREATE_ORDER_DRAFT",
  "SEND_WHATSAPP_FOLLOWUP",
]);

const SOFT_ONLY_ACTIONS = new Set<AutomationActionType>([
  "SCHEDULE_REMINDER",
  "ESCALATE_TO_HUMAN",
]);

const CLOSING_TRIGGERS = new Set<AutomationTriggerKind>([
  "closing_sequence",
  "quotation_followup",
]);

function isAggressiveCommercialAction(
  intent?: AutomationIntentSignal | null,
  trigger?: AutomationTriggerKind | null,
): boolean {
  if (!intent) return Boolean(trigger && CLOSING_TRIGGERS.has(trigger));
  if (AGGRESSIVE_ACTIONS.has(intent.actionType)) return true;
  if (intent.priority === "high" && intent.requiresApproval) return true;
  return Boolean(trigger && CLOSING_TRIGGERS.has(trigger));
}

function isSoftCommercialAction(intent?: AutomationIntentSignal | null, trigger?: AutomationTriggerKind | null): boolean {
  if (intent && SOFT_ONLY_ACTIONS.has(intent.actionType)) return true;
  if (trigger === "gentle_nurture" || trigger === "soft_relaunch") return true;
  return false;
}

function resolveEmotionalRisk(ctx: ConversationAutomationContext): {
  angry: boolean;
  frustrated: boolean;
  annoyed: boolean;
  marketingSuspended: boolean;
} {
  const pem = ctx.conversationState?.prospectEmotionalMemory?.kind;
  const tone = ctx.conversationState?.conversationProfile?.tone;
  const msgEmotion = detectProspectEmotion(ctx.lastUserMessage ?? "");
  const signals = analyzeTriggerSignals(ctx);

  const angry = pem === "angry" || msgEmotion === "anger" || signals.prospectAngry;
  const frustrated =
    pem === "frustrated" ||
    msgEmotion === "frustration" ||
    tone === "aggressive" ||
    /\b(agacé|agace|énervé|enerve|annoyed|annoying)\b/i.test(ctx.lastUserMessage ?? "");
  const annoyed = frustrated || /\b(stop|laisse|arrête|spam|trop\s+de\s+messages)\b/i.test(ctx.lastUserMessage ?? "");

  return {
    angry,
    frustrated,
    annoyed,
    marketingSuspended: angry || frustrated || annoyed || signals.complaint,
  };
}

function isSpecialBusinessPause(config: ReturnType<typeof resolveBusinessHoursConfig>, at: Date): boolean {
  const dt = DateTime.fromJSDate(at, { zone: config.timezone });
  if (!dt.isValid) return false;
  if (process.env.OPTIMA_BUSINESS_PAUSE_SUNDAY === "true" && dt.weekday === 7) return true;
  return false;
}

function buildDelayResult(
  reasons: string[],
  factors: Record<string, string | number | boolean>,
  resumeAt: string,
  toneHint?: AutonomousDecisionResult["toneHint"],
): AutonomousDecisionResult {
  return { state: "DELAY", reasons, factors, resumeAt, toneHint };
}

function buildBlockResult(
  reasons: string[],
  factors: Record<string, string | number | boolean>,
): AutonomousDecisionResult {
  return { state: "BLOCK", reasons, factors };
}

function buildSoftResult(
  reasons: string[],
  factors: Record<string, string | number | boolean>,
): AutonomousDecisionResult {
  return { state: "SOFT_ACTION", reasons, factors, toneHint: "human_soft" };
}

function buildAllowResult(
  reasons: string[],
  factors: Record<string, string | number | boolean>,
  toneHint?: AutonomousDecisionResult["toneHint"],
): AutonomousDecisionResult {
  return { state: "ALLOW", reasons, factors, toneHint };
}

/**
 * Décision centrale avant enqueue / exécution automation.
 */
export function evaluateAutonomousAutomationDecision(
  input: AutonomousDecisionInput,
): AutonomousDecisionResult {
  const ctx = input.ctx;
  const intent = input.intent ?? null;
  const trigger = input.trigger ?? null;
  const factors: Record<string, string | number | boolean> = {};
  const reasons: string[] = [];

  const signals = analyzeTriggerSignals(ctx);
  const emotion = resolveEmotionalRisk(ctx);
  const fatigue = detectFollowupFatigue(ctx);
  const priority = computeLeadPriorityScore(ctx, intent);
  const outbound = isOutboundAutomationAction(intent, input.routedChannel);
  const aggressive = isAggressiveCommercialAction(intent, trigger);
  const softAction = isSoftCommercialAction(intent, trigger);

  factors.leadPriorityScore = priority.score;
  factors.leadBand = priority.band;
  factors.fatigueScore = fatigue.score;
  factors.fatigueLevel = fatigue.level;
  factors.outbound = outbound;
  factors.aggressive = aggressive;
  factors.emotionAngry = emotion.angry;
  factors.emotionFrustrated = emotion.frustrated;

  const tz = ctx.businessIanaTimezone;
  const bizConfig = resolveBusinessHoursConfig(tz);
  const now = new Date();

  if (isSpecialBusinessPause(bizConfig, now)) {
    const resumeAt = nextBusinessWindowStartIso(bizConfig, now);
    reasons.push("Jour de pause business configuré (ex. dimanche) — action reportée.");
    factors.specialDayPause = true;
    return buildDelayResult(reasons, factors, resumeAt);
  }

  if (outbound) {
    const hours = evaluateBusinessHoursForOutbound({
      businessIanaTimezone: tz,
      intent,
      routedChannel: input.routedChannel,
      at: now,
    });
    if (!hours.allowed) {
      reasons.push("Hors horaires business — aucun email/WhatsApp/relance commerciale.");
      factors.outsideBusinessHours = true;
      return buildDelayResult(reasons, factors, hours.resumeAt);
    }
  }

  if (emotion.marketingSuspended && aggressive && !softAction) {
    reasons.push("Prospect en tension (colère / frustration) — vente agressive suspendue.");
    if (softAction || intent?.actionType === "ESCALATE_TO_HUMAN") {
      return buildSoftResult(
        ["Marketing suspendu — seule action douce ou humain autorisée.", ...reasons],
        factors,
      );
    }
    return buildBlockResult(
      [...reasons, "Action commerciale bloquée ; privilégier ton humain et SAV."],
      factors,
    );
  }

  if (emotion.frustrated && aggressive) {
    reasons.push("Prospect frustré — éviter closing / pression.");
    return buildSoftResult(reasons, factors);
  }

  if (fatigue.level === "high" && outbound && !signals.isHot) {
    const resumeAt = new Date(now.getTime() + fatigue.recommendedMinGapMinutes * 60_000).toISOString();
    reasons.push(`Fatigue relance élevée (${fatigue.reasons.join(", ")}) — fréquence réduite.`);
    factors.fatigueHigh = true;
    return buildDelayResult(reasons, factors, resumeAt);
  }

  if (fatigue.shouldReduceFrequency && aggressive) {
    const resumeAt = new Date(now.getTime() + fatigue.recommendedMinGapMinutes * 60_000).toISOString();
    reasons.push("Pression commerciale limitée — trop de relances récentes.");
    factors.pressureLimited = true;
    return buildDelayResult(reasons, factors, resumeAt);
  }

  const relance = ctx.relanceCount ?? 0;
  if (relance >= 3 && aggressive && !signals.isHot && !signals.purchaseIntent) {
    reasons.push("Limite pression vente — plusieurs relances sans signal d’achat.");
    factors.consecutiveClosings = relance;
    return buildBlockResult(reasons, factors);
  }

  if (/\b(urgent|vite|dernière chance|offre expire|plus que \d+ place)\b/i.test(ctx.lastAssistantReply ?? "")) {
    if (relance >= 2) {
      reasons.push("Urgence répétitive détectée côté agent — ralentissement.");
      factors.repeatedUrgency = true;
      const resumeAt = new Date(now.getTime() + 4 * 60 * 60_000).toISOString();
      return buildDelayResult(reasons, factors, resumeAt);
    }
  }

  const lastActive = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at ?? Date.now();
  const silentMs = now.getTime() - Number(lastActive);

  const turns = ctx.conversationState?.stats?.turn_count ?? 0;
  if (input.isAutonomousFollowup && silentMs < SILENCE_BEFORE_FOLLOWUP_MS && turns > 0) {
    const resumeAt = new Date(Number(lastActive) + SILENCE_BEFORE_FOLLOWUP_MS).toISOString();
    reasons.push("Prospect silencieux depuis moins de 2h — pas de relance immédiate.");
    factors.silentMs = silentMs;
    return buildDelayResult(reasons, factors, resumeAt);
  }

  if (signals.prospectSilent && input.isAutonomousFollowup && !signals.isHot) {
    reasons.push("Fenêtre silence — relance douce uniquement après délai.");
    return buildSoftResult(reasons, factors);
  }

  if (priority.band === "hot" || signals.isHot || signals.purchaseIntent) {
    reasons.push("Prospect chaud — relance / action autorisée (rythme accéléré).");
    return buildAllowResult(reasons, factors, "accelerate");
  }

  if (fatigue.level === "medium" && outbound) {
    reasons.push("Fatigue modérée — action autorisée en mode soft uniquement.");
    return buildSoftResult(reasons, factors);
  }

  if (emotion.marketingSuspended) {
    reasons.push("Contexte émotionnel sensible — mode soft par défaut.");
    return buildSoftResult(reasons, factors);
  }

  reasons.push("Contexte favorable — automation autorisée.");
  return buildAllowResult(reasons, factors, "neutral");
}

/** Log structuré pour supervision (JSON-friendly). */
export function formatAutonomousDecisionForLog(decision: AutonomousDecisionResult): string {
  return `[${decision.state}] ${decision.reasons.join(" | ")}`;
}
