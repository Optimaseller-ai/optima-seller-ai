/**
 * Email automation — pont vers le moteur email prospect existant.
 */

import { draftHumanEmail, type EmailFollowupKind } from "@/lib/prospect/email-followups/email-followup-engine";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { AutomationTriggerKind, AutomationLang } from "../types";

function triggerToEmailKind(trigger: AutomationTriggerKind): EmailFollowupKind {
  switch (trigger) {
    case "quotation_followup":
      return "quote_reminder";
    case "order_confirmation":
      return "order_confirmation";
    case "soft_relaunch":
    case "gentle_nurture":
      return "gentle_followup";
    default:
      return "availability_check";
  }
}

export function draftAutomationEmail(args: {
  trigger: AutomationTriggerKind;
  profile: SmartProspectProfile;
  agentName: string;
  businessName: string;
  productFocus?: string;
  lang?: AutomationLang;
}) {
  return draftHumanEmail({
    kind: triggerToEmailKind(args.trigger),
    profile: args.profile,
    agentName: args.agentName,
    businessName: args.businessName,
    productFocus: args.productFocus,
    lang: args.lang,
  });
}
