/**
 * Routage canal — déterministe à partir du profil, des règles et de la confiance.
 */

import type { AutomationIntentSignal } from "./automation-intent-engine";
import type { ConversationAutomationContext } from "./types";
import type { ExecutionChannel } from "./execution-types";

export type ChannelAvailability = Partial<Record<ExecutionChannel, boolean>>;

const DEFAULT_AVAILABILITY: ChannelAvailability = {
  email: true,
  whatsapp: true,
  sms: false,
  human: true,
  crm: true,
  calendar: false,
  chat: true,
};

export type ChannelRouterInput = {
  intent: AutomationIntentSignal;
  ctx: ConversationAutomationContext;
  availability?: ChannelAvailability;
};

/**
 * Priorité email si adresse valide ; sinon WhatsApp si téléphone ; sinon chat / humain.
 */
export function resolveExecutionChannel(input: ChannelRouterInput): ExecutionChannel {
  const avail = { ...DEFAULT_AVAILABILITY, ...input.availability };
  const email = String(input.ctx.prospectLead?.email ?? "").trim();
  const phone = String(input.ctx.prospectLead?.phone ?? "").trim();
  const action = input.intent.actionType;

  if (action === "ESCALATE_TO_HUMAN") return avail.human !== false ? "human" : "chat";

  if (action === "SEND_WHATSAPP_FOLLOWUP" && phone && avail.whatsapp !== false) return "whatsapp";

  if (
    (action === "SEND_PRODUCT_EMAIL" ||
      action === "COLLECT_EMAIL_AND_SEND_DETAILS" ||
      action === "REQUEST_QUOTE_DETAILS") &&
    email &&
    avail.email !== false
  ) {
    return "email";
  }

  if (phone && avail.whatsapp !== false && input.intent.confidence >= 55) return "whatsapp";

  if (email && avail.email !== false) return "email";

  if (avail.calendar && /\b(rdv|rendez-vous|calendar|agenda)\b/i.test(input.ctx.lastUserMessage)) return "calendar";

  if (avail.crm !== false) return "crm";

  return avail.chat !== false ? "chat" : "human";
}
