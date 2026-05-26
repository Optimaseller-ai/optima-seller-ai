/**
 * Anti-spam human logic — délais naturels, limites, variations.
 */

import type { AutomationTriggerKind, ConversationAutomationContext } from "../types";

const MAX_RELANCE_BY_STAGE: Record<string, number> = {
  new_lead: 2,
  interested: 3,
  warm: 4,
  hot: 5,
  negotiating: 4,
  ready_to_buy: 3,
  customer: 1,
  lost: 0,
};

const MIN_GAP_MINUTES: Record<AutomationTriggerKind, number> = {
  quotation_followup: 60,
  soft_relaunch: 120,
  closing_sequence: 30,
  gentle_nurture: 24 * 60,
  no_commercial_push: 48 * 60,
  order_confirmation: 15,
  delivery_update: 60,
  sav_ticket: 30,
  human_handoff: 10,
  message_received: 0,
  interest_signal: 45,
  checkout_started: 25,
};

export function canSendFollowup(ctx: ConversationAutomationContext, trigger: AutomationTriggerKind): {
  allowed: boolean;
  reason: string;
} {
  const relance = ctx.relanceCount ?? 0;
  const stage = ctx.pipelineStage ?? "interested";
  const max = MAX_RELANCE_BY_STAGE[stage] ?? 3;

  if (relance >= max) {
    return { allowed: false, reason: `max_relance_${max}_for_stage_${stage}` };
  }

  const angry =
    ctx.conversationState?.prospectEmotionalMemory?.kind === "angry" ||
    ctx.conversationState?.prospectEmotionalMemory?.kind === "frustrated";
  if (angry && (trigger === "closing_sequence" || trigger === "quotation_followup")) {
    return { allowed: false, reason: "prospect_angry_no_hard_sell" };
  }

  const minGap = MIN_GAP_MINUTES[trigger] ?? 60;
  const lastActive = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at;
  if (lastActive && Date.now() - lastActive < minGap * 60_000) {
    return { allowed: false, reason: `min_gap_${minGap}m` };
  }

  return { allowed: true, reason: "ok" };
}

export function pickFollowupVariant(seed: string, variants: string[]): string {
  if (!variants.length) return "";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return variants[h % variants.length]!;
}
