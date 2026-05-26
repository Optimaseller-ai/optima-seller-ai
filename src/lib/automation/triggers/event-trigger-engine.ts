/**
 * Event Trigger System — chaque signal conversationnel génère des triggers métier.
 */

import type {
  AutomationEventName,
  AutomationTrigger,
  AutomationTriggerKind,
  ConversationAutomationContext,
} from "../types";
import { analyzeTriggerSignals } from "./trigger-signals";
import { evaluateAutomationEligibility } from "../automation-eligibility-engine";

function trigger(
  kind: AutomationTriggerKind,
  event: AutomationEventName,
  priority: number,
  reason: string,
  extra?: Partial<AutomationTrigger>,
): AutomationTrigger {
  return { kind, event, priority, reason, ...extra };
}

/**
 * Dérive les triggers à partir du dernier tour conversationnel.
 */
export function deriveConversationTriggers(ctx: ConversationAutomationContext): AutomationTrigger[] {
  const signals = analyzeTriggerSignals(ctx);
  const out: AutomationTrigger[] = [];
  const m = String(ctx.lastUserMessage ?? "");

  out.push(trigger("message_received", "message.received", 5, "Message prospect reçu — bus SaaS"));

  if (signals.isNewLead) {
    out.push(trigger("gentle_nurture", "lead.created", 10, "Nouveau lead pré-chat ou premier tour"));
    out.push(trigger("gentle_nurture", "prospect.created", 11, "Création prospect (alias SaaS)"));
  }

  if (signals.emailCollected) {
    out.push(trigger("gentle_nurture", "email.collected", 15, "Email prospect capturé"));
  }

  if (signals.priceAsked) {
    out.push(
      trigger("quotation_followup", "quote.requested", 40, "Demande prix / devis", {
        channel: "chat",
        metadata: { productFocus: ctx.prospectLead?.primaryNeed },
      }),
    );
  }

  if (signals.priceAsked && !signals.purchaseIntent) {
    out.push(
      trigger("interest_signal", "interest.detected", 28, "Intérêt commercial détecté (prix/devis)", {
        channel: "chat",
        metadata: { priceAsked: signals.priceAsked },
      }),
    );
  }

  if (signals.purchaseIntent) {
    out.push(
      trigger("closing_sequence", "purchase.intent", 50, "Intention d’achat explicite", {
        channel: "chat",
      }),
    );
  }

  if (signals.isHot) {
    out.push(trigger("closing_sequence", "lead.hot", 45, "Prospect chaud"));
  } else if (signals.isWarm && (signals.priceAsked || signals.purchaseIntent)) {
    out.push(trigger("quotation_followup", "lead.warm", 30, "Prospect tiède (signal commercial)"));
  }

  if (signals.prospectSilent && !signals.prospectAngry) {
    out.push(
      trigger("soft_relaunch", "prospect.silent", 35, "Silence prospect > 2h", {
        channel: "chat",
      }),
    );
  }

  if (signals.cartAbandoned) {
    out.push(trigger("soft_relaunch", "cart.abandoned", 38, "Panier / intérêt abandonné"));
  }

  if (signals.prospectAngry || signals.complaint) {
    out.push(
      trigger("no_commercial_push", "customer.angry", 60, "Plainte ou colère — pas de relance agressive", {
        channel: "chat",
      }),
    );
    out.push(trigger("sav_ticket", "complaint.raised", 55, "Ouverture ticket SAV suggérée"));
  }

  if (signals.orderConfirmed) {
    out.push(trigger("order_confirmation", "order.confirmed", 50, "Commande validée"));
  }

  const checkoutStarted =
    /\b(checkout|passer\s+(?:la\s+)?commande|finaliser\s+(?:la\s+)?commande|je\s+valide\s+(?:la\s+)?commande)\b/i.test(
      m,
    ) && !signals.orderConfirmed;
  if (checkoutStarted) {
    out.push(
      trigger("checkout_started", "order.started", 42, "Tunnel commande démarré", {
        channel: "chat",
      }),
    );
  }

  out.sort((a, b) => b.priority - a.priority);

  const seen = new Set<string>();
  return out.filter((t) => {
    const key = `${t.kind}:${t.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Événements n8n normalisés à partir des triggers. */
export function triggersToN8nEvents(triggers: AutomationTrigger[]): AutomationEventName[] {
  return [...new Set(triggers.map((t) => t.event))];
}
