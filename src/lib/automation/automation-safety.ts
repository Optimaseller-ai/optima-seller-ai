/**
 * Garde-fous globaux avant exécution automatique (spam, fréquence, doublons, horaires, boucles).
 */

import "server-only";

import { assertNotDuplicate, buildIdempotencyKey } from "./anti-duplicate";
import { resolveRegistryByIntent } from "./workflow-registry";
import { DateTime } from "luxon";
import { canSendFollowup } from "./followups/anti-spam-human";
import type { AutomationIntentSignal } from "./automation-intent-engine";
import type { AutomationTriggerKind, ConversationAutomationContext } from "./types";

const recentIntentHashes = new Map<string, number[]>();
const LOOP_WINDOW_MS = 12 * 60 * 60 * 1000;
const LOOP_MAX_SAME = 4;

function quietHours(businessIanaTimezone?: string): boolean {
  const z = String(businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const dt = DateTime.now().setZone(z);
  if (!dt.isValid) return false;
  const h = dt.hour;
  return h >= 22 || h < 9;
}

function hashIntent(sessionId: string, intent: AutomationIntentSignal): string {
  return buildIdempotencyKey([sessionId, intent.actionType, intent.suggestedWorkflow]);
}

export type AutomationSafetyResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "duplicate"
        | "quiet_hours"
        | "loop_detected"
        | "aggressive_followup_blocked"
        | "rate_limited";
    };

export type AutomationSafetyInput = {
  sessionId: string;
  agentId: string;
  businessIanaTimezone?: string;
  /** Idempotence métier optionnelle (ex. hash message). */
  idempotencyKey?: string;
  intent?: AutomationIntentSignal | null;
  /** Si une relance est envisagée avec ce trigger */
  followupTrigger?: AutomationTriggerKind | null;
  ctx?: ConversationAutomationContext | null;
  bypassQuietHours?: boolean;
};

/**
 * Couche sécurité automation — à appeler avant enqueue / envoi n8n automatique.
 */
export function evaluateAutomationSafety(args: AutomationSafetyInput): AutomationSafetyResult {
  if (args.intent) {
    const registry = resolveRegistryByIntent(args.intent.actionType);
    if (registry) {
      if (!registry.enabled) {
        return { ok: false, reason: "aggressive_followup_blocked" };
      }
      const cooldownKey = buildIdempotencyKey(["workflow_cooldown", args.sessionId, registry.id]);
      if (!assertNotDuplicate(cooldownKey, registry.cooldownMs)) {
        return { ok: false, reason: "duplicate" };
      }
    }
  }

  if (args.idempotencyKey) {
    const key = buildIdempotencyKey(["automation_safety", args.sessionId, args.idempotencyKey]);
    if (!assertNotDuplicate(key, 90 * 60 * 1000)) {
      return { ok: false, reason: "duplicate" };
    }
  }

  if (!args.bypassQuietHours && quietHours(args.businessIanaTimezone)) {
    const aggressive =
      args.intent?.actionType === "SEND_WHATSAPP_FOLLOWUP" ||
      args.intent?.actionType === "SEND_PRODUCT_EMAIL" ||
      args.followupTrigger === "closing_sequence";
    if (aggressive) {
      return { ok: false, reason: "quiet_hours" };
    }
  }

  if (args.intent) {
    const h = hashIntent(args.sessionId, args.intent);
    const now = Date.now();
    const bucket = (recentIntentHashes.get(h) ?? []).filter((t) => now - t < LOOP_WINDOW_MS);
    bucket.push(now);
    recentIntentHashes.set(h, bucket);
    if (bucket.length > LOOP_MAX_SAME) {
      return { ok: false, reason: "loop_detected" };
    }
  }

  if (args.followupTrigger && args.ctx) {
    const spam = canSendFollowup(args.ctx, args.followupTrigger);
    if (!spam.allowed) {
      return { ok: false, reason: "aggressive_followup_blocked" };
    }
  }

  return { ok: true };
}
