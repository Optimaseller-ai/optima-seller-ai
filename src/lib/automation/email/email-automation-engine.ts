/**
 * Email Automation Engine — types d’emails métier (pont vers drafts humains).
 */

import "server-only";

import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { AutomationLang } from "../types";
import { draftAutomationEmail } from "./email-automation";

export type EmailAutomationKind =
  | "product_recap"
  | "followup"
  | "quote"
  | "welcome"
  | "abandoned_conversation"
  | "hot_lead";

export type EmailAutomationDraft = {
  kind: EmailAutomationKind;
  subject: string;
  body: string;
  requiresApproval: boolean;
};

type BaseArgs = {
  profile: SmartProspectProfile;
  agentName: string;
  businessName: string;
  productFocus?: string;
  lang?: AutomationLang;
};

function triggerForKind(kind: EmailAutomationKind): import("../types").AutomationTriggerKind {
  switch (kind) {
    case "quote":
      return "quotation_followup";
    case "welcome":
      return "gentle_nurture";
    case "abandoned_conversation":
      return "soft_relaunch";
    case "hot_lead":
      return "closing_sequence";
    case "product_recap":
    case "followup":
    default:
      return "interest_signal";
  }
}

function buildDraft(kind: EmailAutomationKind, args: BaseArgs): EmailAutomationDraft {
  const trigger = triggerForKind(kind);
  const email = draftAutomationEmail({
    trigger,
    profile: args.profile,
    agentName: args.agentName,
    businessName: args.businessName,
    productFocus: args.productFocus,
    lang: args.lang,
  });

  const subjectOverrides: Partial<Record<EmailAutomationKind, string>> = {
    product_recap: `Récap — ${args.businessName}`,
    welcome: `Bienvenue — ${args.businessName}`,
    hot_lead: `Suite à votre intérêt — ${args.businessName}`,
    abandoned_conversation: `On reprend votre demande — ${args.businessName}`,
    quote: `Votre devis — ${args.businessName}`,
  };

  return {
    kind,
    subject: subjectOverrides[kind] ?? email.subject,
    body: email.body,
    requiresApproval: kind === "hot_lead" || kind === "quote" ? true : kind !== "followup",
  };
}

export function sendProductRecapEmail(args: BaseArgs) {
  return buildDraft("product_recap", args);
}

export function sendFollowupEmail(args: BaseArgs) {
  return buildDraft("followup", args);
}

export function sendQuoteEmail(args: BaseArgs) {
  return buildDraft("quote", args);
}

export function sendWelcomeEmail(args: BaseArgs) {
  return buildDraft("welcome", args);
}

export function sendAbandonedConversationEmail(args: BaseArgs) {
  return buildDraft("abandoned_conversation", args);
}

export function sendHotLeadEmail(args: BaseArgs) {
  return buildDraft("hot_lead", args);
}
