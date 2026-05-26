/**
 * Auto Actions (Module 7) — registre d’actions futures (PDF, devis, SAV, etc.).
 */

import type { AutoActionKind, ConversationAutomationContext } from "../types";

export type AutoActionDefinition = {
  kind: AutoActionKind;
  label: string;
  enabled: boolean;
  /** Condition minimale pour proposer l’action (pas d’exécution auto sans intégration). */
  when: (ctx: ConversationAutomationContext) => boolean;
};

export const AUTO_ACTION_REGISTRY: AutoActionDefinition[] = [
  {
    kind: "send_catalog",
    label: "Envoyer catalogue",
    enabled: false,
    when: (ctx) => /\b(catalogue|catalog|liste\s+des\s+produits)\b/i.test(ctx.lastUserMessage),
  },
  {
    kind: "send_quote",
    label: "Envoyer devis",
    enabled: false,
    when: (ctx) => /\b(devis|quote|prix\s+total)\b/i.test(ctx.lastUserMessage),
  },
  {
    kind: "send_pdf",
    label: "Envoyer PDF",
    enabled: false,
    when: () => false,
  },
  {
    kind: "send_invoice",
    label: "Envoyer facture",
    enabled: false,
    when: (ctx) => /\b(facture|invoice)\b/i.test(ctx.lastUserMessage),
  },
  {
    kind: "create_order",
    label: "Créer commande",
    enabled: false,
    when: (ctx) => /\b(je\s+commande|je\s+valide|je\s+prends)\b/i.test(ctx.lastUserMessage),
  },
  {
    kind: "create_sav_ticket",
    label: "Ticket SAV",
    enabled: false,
    when: (ctx) => /\b(sav|réclamation|plainte|problème|defect)\b/i.test(ctx.lastUserMessage),
  },
  {
    kind: "trigger_human_call",
    label: "Appel humain",
    enabled: false,
    when: (ctx) => /\b(appeler|téléphone|phone\s+call|me\s+rappeler)\b/i.test(ctx.lastUserMessage),
  },
];

export function suggestAutoActions(ctx: ConversationAutomationContext): AutoActionKind[] {
  return AUTO_ACTION_REGISTRY.filter((a) => a.enabled && a.when(ctx)).map((a) => a.kind);
}
