/**
 * Protection horaires business — aucun email / WhatsApp / relance hors créneau.
 */

import "server-only";

import { DateTime } from "luxon";

import type { AutomationIntentSignal } from "./automation-intent-engine";
import type { ExecutionChannel } from "./execution-types";

export type BusinessHoursConfig = {
  /** Heure locale inclusive (0–23). Défaut 9. */
  startHour: number;
  /** Heure locale exclusive pour fin de journée (ex. 22 = jusqu’à 21:59). Défaut 22. */
  endHour: number;
  timezone: string;
};

const OUTBOUND_ACTION_TYPES = new Set([
  "SEND_PRODUCT_EMAIL",
  "COLLECT_EMAIL_AND_SEND_DETAILS",
  "SEND_WHATSAPP_FOLLOWUP",
  "SCHEDULE_REMINDER",
  "REQUEST_QUOTE_DETAILS",
]);

const OUTBOUND_CHANNELS = new Set<ExecutionChannel>(["email", "whatsapp", "sms"]);

export function resolveBusinessHoursConfig(timezone?: string): BusinessHoursConfig {
  const startRaw = Number(process.env.OPTIMA_BUSINESS_HOURS_START ?? "9");
  const endRaw = Number(process.env.OPTIMA_BUSINESS_HOURS_END ?? "22");
  return {
    startHour: Number.isFinite(startRaw) ? Math.max(0, Math.min(23, startRaw)) : 9,
    endHour: Number.isFinite(endRaw) ? Math.max(1, Math.min(24, endRaw)) : 22,
    timezone: String(timezone ?? process.env.OPTIMA_BUSINESS_TIMEZONE ?? "Africa/Douala").trim() || "Africa/Douala",
  };
}

export function isWithinBusinessHours(at: Date, config: BusinessHoursConfig): boolean {
  const dt = DateTime.fromJSDate(at, { zone: config.timezone });
  if (!dt.isValid) return true;
  const h = dt.hour;
  return h >= config.startHour && h < config.endHour;
}

/** Prochain instant UTC (ISO) où la fenêtre business s’ouvre. */
export function nextBusinessWindowStartIso(config: BusinessHoursConfig, from = new Date()): string {
  let dt = DateTime.fromJSDate(from, { zone: config.timezone });
  if (!dt.isValid) return new Date(from.getTime() + 60 * 60_000).toISOString();

  for (let i = 0; i < 48; i++) {
    if (dt.hour < config.startHour) {
      dt = dt.set({ hour: config.startHour, minute: 5, second: 0, millisecond: 0 });
    } else if (dt.hour >= config.endHour) {
      dt = dt.plus({ days: 1 }).set({ hour: config.startHour, minute: 5, second: 0, millisecond: 0 });
    } else {
      return dt.toUTC().toISO() ?? new Date().toISOString();
    }
  }
  return new Date(from.getTime() + 12 * 60 * 60_000).toISOString();
}

export function isOutboundAutomationAction(
  intent?: AutomationIntentSignal | null,
  channel?: ExecutionChannel,
): boolean {
  if (channel && OUTBOUND_CHANNELS.has(channel)) return true;
  if (!intent) return false;
  return OUTBOUND_ACTION_TYPES.has(intent.actionType);
}

export type BusinessHoursGateResult =
  | { allowed: true }
  | { allowed: false; reason: "outside_business_hours"; resumeAt: string };

export function evaluateBusinessHoursForOutbound(args: {
  businessIanaTimezone?: string;
  intent?: AutomationIntentSignal | null;
  routedChannel?: ExecutionChannel;
  at?: Date;
}): BusinessHoursGateResult {
  if (!isOutboundAutomationAction(args.intent, args.routedChannel)) {
    return { allowed: true };
  }

  const config = resolveBusinessHoursConfig(args.businessIanaTimezone);
  const at = args.at ?? new Date();
  if (isWithinBusinessHours(at, config)) return { allowed: true };

  return {
    allowed: false,
    reason: "outside_business_hours",
    resumeAt: nextBusinessWindowStartIso(config, at),
  };
}
