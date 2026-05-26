/**
 * Mode validation humaine — stable pour UI (envoyer / modifier / annuler).
 */

import type { AutomationIntentSignal } from "./automation-intent-engine";

export type HumanApprovalChoice = "send" | "modify" | "cancel";

export type HumanApprovalCard = {
  id: string;
  title: string;
  body: string;
  intentSummary: string;
  actions: Array<{
    id: HumanApprovalChoice;
    label: string;
    variant: "primary" | "secondary" | "danger";
  }>;
  intent: AutomationIntentSignal;
};

let seq = 0;
function nextId() {
  seq += 1;
  return `hap_${Date.now().toString(36)}_${seq}`;
}

/**
 * Copy prêt pour toast / modal admin — les boutons correspondent aux actions utilisateur.
 */
export function buildHumanApprovalCard(args: {
  intent: AutomationIntentSignal;
  agentDisplayName?: string;
  locale?: "fr" | "en";
}): HumanApprovalCard {
  const locale = args.locale ?? "fr";
  const who = args.agentDisplayName?.trim() || (locale === "fr" ? "L’agent" : "The agent");

  const title =
    locale === "fr"
      ? "Validation requise avant envoi automatique"
      : "Approval required before automation runs";

  const intentSummary =
    locale === "fr"
      ? `${who} souhaite lancer « ${args.intent.actionType} » (${args.intent.confidence}% confiance, workflow ${args.intent.suggestedWorkflow}).`
      : `${who} wants to run “${args.intent.actionType}” (${args.intent.confidence}% confidence, workflow ${args.intent.suggestedWorkflow}).`;

  const body =
    locale === "fr"
      ? [
          intentSummary,
          "",
          "Choisissez une action : envoyer tel quel, modifier le scénario, ou annuler pour rester 100 % manuel.",
        ].join("\n")
      : [
          intentSummary,
          "",
          "Pick an action: send as proposed, adjust the workflow, or cancel to stay fully manual.",
        ].join("\n");

  return {
    id: nextId(),
    title,
    body,
    intentSummary,
    intent: args.intent,
    actions: [
      {
        id: "send",
        label: locale === "fr" ? "Envoyer" : "Send",
        variant: "primary",
      },
      {
        id: "modify",
        label: locale === "fr" ? "Modifier" : "Modify",
        variant: "secondary",
      },
      {
        id: "cancel",
        label: locale === "fr" ? "Annuler" : "Cancel",
        variant: "danger",
      },
    ],
  };
}
