/**
 * Bus événements métier documenté produit — sous-ensemble stable des `AutomationEventName`.
 */

import type { BusinessEventName, ConversationAutomationContext } from "./types";
import { deriveConversationTriggers } from "./triggers/event-trigger-engine";

export const DOCUMENTED_BUSINESS_EVENTS: readonly BusinessEventName[] = [
  "prospect.created",
  "message.received",
  "interest.detected",
  "purchase.intent",
  "prospect.silent",
  "email.collected",
  "order.started",
] as const;

export function isBusinessEventName(name: string): name is BusinessEventName {
  return (DOCUMENTED_BUSINESS_EVENTS as readonly string[]).includes(name);
}

/**
 * Liste plate des événements SaaS pour ce tour — prête pour n8n / analytics.
 */
export function deriveBusinessEvents(ctx: ConversationAutomationContext): BusinessEventName[] {
  const triggers = deriveConversationTriggers(ctx);
  const out: BusinessEventName[] = [];
  for (const t of triggers) {
    if (isBusinessEventName(t.event)) out.push(t.event);
  }
  return [...new Set(out)];
}

