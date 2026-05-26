import type { ConversationAutomationContext } from "../types";

export type TriggerSignalSnapshot = {
  isNewLead: boolean;
  isHot: boolean;
  isWarm: boolean;
  isCold: boolean;
  priceAsked: boolean;
  purchaseIntent: boolean;
  prospectSilent: boolean;
  prospectAngry: boolean;
  complaint: boolean;
  orderConfirmed: boolean;
  emailCollected: boolean;
  cartAbandoned: boolean;
};

export function analyzeTriggerSignals(ctx: ConversationAutomationContext): TriggerSignalSnapshot {
  const m = String(ctx.lastUserMessage ?? "").toLowerCase();
  const temp = ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature ?? "cold";
  const turn = ctx.conversationState?.stats?.turn_count ?? 0;

  const priceAsked = /\b(prix|combien|tarif|devis|quote|budget|fcfa|cfa|€|how\s+much|precio)\b/i.test(m);
  const purchaseIntent = /\b(je\s+prends|je\s+commande|je\s+valide|acheter|commander|i\s+want\s+to\s+buy|quiero\s+comprar)\b/i.test(m);
  const complaint = /\b(arnaque|scam|plainte|réclamation|honte|inadmissible|nul|pas\s+content)\b/i.test(m);
  const prospectAngry = complaint || /\b(marre|énerv|enerve|😠|😡)\b/i.test(m);
  const orderConfirmed = /\b(commande\s+valid|paiement\s+effectu|payé|paye|paid|confirmé)\b/i.test(m);
  const emailCollected = Boolean(ctx.prospectLead?.email?.trim());
  const lastActive = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at ?? Date.now();
  const silentMs = Date.now() - lastActive;
  const prospectSilent = silentMs > 2 * 60 * 60 * 1000 && turn > 0;

  return {
    isNewLead: turn <= 1 && Boolean(ctx.prospectLead?.name),
    isHot: temp === "hot" || temp === "ready_to_buy",
    isWarm: temp === "warm",
    isCold: temp === "cold",
    priceAsked,
    purchaseIntent,
    prospectSilent,
    prospectAngry,
    complaint,
    orderConfirmed,
    emailCollected,
    cartAbandoned: prospectSilent && (temp === "warm" || temp === "hot") && priceAsked,
  };
}
