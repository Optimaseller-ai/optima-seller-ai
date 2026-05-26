import "server-only";

import { assertNotDuplicate, buildIdempotencyKey } from "@/lib/automation/anti-duplicate";
import { DateTime } from "luxon";

const cooldownUntil = new Map<string, number>();
const hourlyBuckets = new Map<string, { windowStart: number; count: number }>();

/** Fenêtre locale basique : pas d’envois intensifs 22h–9h (aligné quiet-hours). */
export function isWithinAgentActionQuietHours(businessIanaTimezone?: string): boolean {
  const z = String(businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const dt = DateTime.now().setZone(z);
  if (!dt.isValid) return false;
  const h = dt.hour;
  return h >= 22 || h < 9;
}

function cooldownKey(sessionId: string, kind: string) {
  return buildIdempotencyKey([sessionId, "cooldown", kind]);
}

function rateKey(agentId: string) {
  const hour = Math.floor(Date.now() / 3_600_000);
  return `${agentId}|${hour}`;
}

export type ActionSafetyResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "cooldown" | "rate_limit" | "quiet_hours" };

/** Anti-double déclenchement — à appeler avant validation humaine pour éviter double enqueue. */
export function evaluateAgentActionDuplicate(args: {
  sessionId: string;
  idempotencyKey?: string;
}): ActionSafetyResult {
  if (!args.idempotencyKey) return { ok: true };
  const dupKey = buildIdempotencyKey(["agent_action", args.sessionId, args.idempotencyKey]);
  if (!assertNotDuplicate(dupKey, 2 * 60 * 60 * 1000)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true };
}

/**
 * Anti-spam, anti-boucle, rate-limit léger, respect fenêtre nuit.
 * Appeler après duplicate + validation humaine si besoin.
 */
export function evaluateAgentActionSafety(args: {
  sessionId: string;
  agentId: string;
  actionKind: string;
  businessIanaTimezone?: string;
  cooldownMs?: number;
  maxPerAgentHour?: number;
  respectQuietHours?: boolean;
  bypassQuietHours?: boolean;
}): ActionSafetyResult {
  const maxPer = args.maxPerAgentHour ?? 24;
  const respectQuiet = args.respectQuietHours !== false;

  const ck = cooldownKey(args.sessionId, args.actionKind);
  const exp = cooldownUntil.get(ck);
  if (typeof exp === "number" && exp > Date.now()) {
    return { ok: false, reason: "cooldown" };
  }

  const rk = rateKey(args.agentId);
  const bucket = hourlyBuckets.get(rk) ?? { windowStart: Date.now(), count: 0 };
  if (Date.now() - bucket.windowStart > 3_600_000) {
    bucket.windowStart = Date.now();
    bucket.count = 0;
  }
  bucket.count += 1;
  hourlyBuckets.set(rk, bucket);
  if (bucket.count > maxPer) {
    return { ok: false, reason: "rate_limit" };
  }

  if (respectQuiet && !args.bypassQuietHours && isWithinAgentActionQuietHours(args.businessIanaTimezone)) {
    return { ok: false, reason: "quiet_hours" };
  }

  const defaultCooldown =
    args.actionKind === "send_whatsapp_followup" || args.actionKind === "send_email"
      ? 25 * 60 * 1000
      : 4 * 60 * 1000;
  const cd = args.cooldownMs ?? defaultCooldown;
  cooldownUntil.set(ck, Date.now() + cd);

  return { ok: true };
}
