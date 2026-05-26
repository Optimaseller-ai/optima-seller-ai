/**
 * Automation Scheduler — délais explicites (30 min, 2 h, 24 h, 3 j) + fuseau business.
 */

import { DateTime } from "luxon";
import { snapUtcInstantOutOfQuietHours } from "@/lib/agents/timing/quiet-hours";
import type { ConversationAutomationContext } from "../types";
import type { LeadTemperature } from "@/lib/prospect/lead-profile/prospect-profile";

export type AutomationDelayPreset = "30m" | "2h" | "24h" | "3d";

export type AutomationScheduleResult = {
  scheduledFor: string;
  delayMinutes: number;
  preset: AutomationDelayPreset;
  slot: "morning" | "afternoon" | "evening";
  reason: string;
  timezone: string;
};

const PRESET_MINUTES: Record<AutomationDelayPreset, number> = {
  "30m": 30,
  "2h": 120,
  "24h": 24 * 60,
  "3d": 3 * 24 * 60,
};

function presetFromContext(args: {
  interestLevel?: "low" | "medium" | "high";
  leadTemperature?: LeadTemperature | string;
}): AutomationDelayPreset {
  const temp = args.leadTemperature;
  if (args.interestLevel === "high" || temp === "hot" || temp === "ready") return "30m";
  if (temp === "warm") return "2h";
  if (temp === "cold") return "3d";
  return "24h";
}

function inferSlot(ctx: ConversationAutomationContext): AutomationScheduleResult["slot"] {
  const last = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at;
  if (!last) return "evening";
  const tz = ctx.businessIanaTimezone?.trim() || "Africa/Douala";
  const h = DateTime.fromMillis(last, { zone: "utc" }).setZone(tz).hour;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "evening";
}

function snapToBusinessSlot(baseMs: number, slot: AutomationScheduleResult["slot"], tz: string): number {
  const dt = DateTime.fromMillis(baseMs, { zone: "utc" }).setZone(tz);
  const hour = slot === "morning" ? 10 : slot === "afternoon" ? 15 : 19;
  let target = dt.set({ hour, minute: 10, second: 0, millisecond: 0 });
  if (target.toMillis() <= Date.now()) target = target.plus({ days: 1 });
  return snapUtcInstantOutOfQuietHours(target.toUTC().toMillis(), tz);
}

/**
 * Choisit un délai selon température / intérêt, en respectant le fuseau du business.
 */
export function scheduleAutomationDelay(args: {
  ctx: ConversationAutomationContext;
  preset?: AutomationDelayPreset;
  interestLevel?: "low" | "medium" | "high";
  leadTemperature?: LeadTemperature | string;
  from?: Date;
}): AutomationScheduleResult {
  const tz = args.ctx.businessIanaTimezone?.trim() || "Africa/Douala";
  const preset =
    args.preset ??
    presetFromContext({
      interestLevel: args.interestLevel,
      leadTemperature: args.leadTemperature ?? args.ctx.leadTemperature,
    });
  const delayMinutes = PRESET_MINUTES[preset];
  const from = args.from ?? new Date();
  const slot = inferSlot(args.ctx);
  let atMs = from.getTime() + delayMinutes * 60_000;
  atMs = snapToBusinessSlot(atMs, slot, tz);

  return {
    scheduledFor: new Date(atMs).toISOString(),
    delayMinutes,
    preset,
    slot,
    reason: `preset=${preset} interest=${args.interestLevel ?? "auto"} temp=${args.leadTemperature ?? args.ctx.leadTemperature ?? "n/a"}`,
    timezone: tz,
  };
}
