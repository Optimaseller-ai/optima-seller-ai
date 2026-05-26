/**
 * WhatsApp Followup Adapter — prêt pour Cloud API (message, délai, template, média, voix).
 */

import "server-only";

import type { AutomationLang, ConversationAutomationContext } from "../types";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import { scheduleAutomationDelay } from "../scheduler/automation-scheduler";
import { draftWhatsappFollowup, triggerToWhatsappKind, type WhatsappFollowupKind } from "./whatsapp-followup-engine";

export type WhatsappMediaKind = "none" | "image" | "document" | "audio" | "video";

export type WhatsappFollowupPlan = {
  channel: "whatsapp";
  message: string;
  delayMinutes: number;
  scheduledFor: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  media?: {
    kind: WhatsappMediaKind;
    url?: string;
    caption?: string;
  };
  voice?: {
    enabled: boolean;
    script?: string;
    /** Future: URL note vocale générée */
    assetUrl?: string;
  };
  smartTiming: {
    slot: string;
    reason: string;
    timezone: string;
  };
  kind: WhatsappFollowupKind;
  requiresApproval: boolean;
};

export type WhatsappFollowupAdapterInput = {
  ctx: ConversationAutomationContext;
  profile?: SmartProspectProfile;
  trigger: import("../types").AutomationTriggerKind;
  agentName: string;
  businessName: string;
  productFocus?: string;
  lang?: AutomationLang;
  interestLevel?: "low" | "medium" | "high";
  templateId?: string;
  media?: WhatsappFollowupPlan["media"];
  voiceEnabled?: boolean;
};

/**
 * Planifie une relance WhatsApp (contenu + créneau) sans appeler l’API Meta.
 */
export function planWhatsappFollowup(input: WhatsappFollowupAdapterInput): WhatsappFollowupPlan {
  const kind = triggerToWhatsappKind(input.trigger);
  const draft = draftWhatsappFollowup({
    kind,
    trigger: input.trigger,
    profile: input.profile ?? input.ctx.prospectLead,
    agentName: input.agentName,
    businessName: input.businessName,
    productFocus: input.productFocus,
    lang: input.lang ?? input.ctx.lang,
  });

  const schedule = scheduleAutomationDelay({
    ctx: input.ctx,
    interestLevel: input.interestLevel,
    leadTemperature: input.ctx.leadTemperature ?? input.profile?.leadTemperature,
    preset: input.interestLevel === "high" ? "30m" : undefined,
  });

  const requiresApproval =
    input.interestLevel === "high"
      ? false
      : kind === "closing_ping" || kind === "quote_reminder";

  return {
    channel: "whatsapp",
    message: draft.body,
    delayMinutes: schedule.delayMinutes,
    scheduledFor: schedule.scheduledFor,
    templateId: input.templateId,
    templateVariables: {
      prospect_name: input.profile?.name ?? input.ctx.prospectLead?.name ?? "",
      agent_name: input.agentName,
      business_name: input.businessName,
    },
    media: input.media ?? { kind: "none" },
    voice: {
      enabled: input.voiceEnabled === true,
      script: input.voiceEnabled ? draft.body.slice(0, 500) : undefined,
    },
    smartTiming: {
      slot: schedule.slot,
      reason: schedule.reason,
      timezone: schedule.timezone,
    },
    kind,
    requiresApproval,
  };
}
