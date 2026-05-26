/**
 * WhatsApp Automation Engine — relances style conseiller humain (pas robot).
 */

import {
  frenchHonorificSmart,
  englishHonorificSmart,
  spanishHonorificSmart,
  type ProspectProfile,
} from "@/lib/agents/memory/prospect-profile";
import { pickFollowupVariant } from "../followups/anti-spam-human";
import type { AutomationLang, AutomationTriggerKind } from "../types";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

function honorificProfile(lead?: SmartProspectProfile): ProspectProfile | undefined {
  if (!lead?.name?.trim()) return undefined;
  return {
    displayName: lead.name.trim(),
    civility: "unknown",
    languageHint: lead.language === "en" ? "en" : lead.language === "fr" ? "fr" : "unknown",
    habits: [],
    tonePreference: "neutral",
    historySnippets: [],
    updatedAt: Date.now(),
  };
}

export type WhatsappFollowupKind =
  | "gentle_relaunch"
  | "quote_reminder"
  | "order_confirmation"
  | "delivery_update"
  | "closing_ping";

export type WhatsappFollowupDraft = {
  body: string;
  kind: WhatsappFollowupKind;
};

export type WhatsappFollowupInput = {
  kind: WhatsappFollowupKind;
  trigger?: AutomationTriggerKind;
  profile?: SmartProspectProfile;
  agentName: string;
  businessName: string;
  productFocus?: string;
  lang?: AutomationLang;
  seed?: string;
};

function variantsFr(args: WhatsappFollowupInput, honor: string | null, focus: string): string[] {
  const agent = args.agentName.trim() || "Bryan";
  const h = honor ? ` ${honor}` : " Monsieur";
  const base = focus
    ? `Je reviens vers vous concernant ${focus} consulté plus tôt.`
    : `Je reviens vers vous concernant votre demande d’hier.`;

  if (args.kind === "order_confirmation") {
    return [`Bonsoir${h}.\n${agent} du service commercial.\n\nNous avons bien enregistré votre demande.`];
  }
  if (args.kind === "delivery_update") {
    return [`Bonjour${h}.\n${agent} — petite mise à jour sur votre livraison, je vous confirme dès que c’est prêt.`];
  }
  if (args.kind === "closing_ping") {
    return [`Bonsoir${h}.\n${agent} du service commercial.\n\n${base}\n\nJe reste disponible si besoin.`];
  }
  return [
    `Bonsoir${h}.\n${agent} du service commercial.\n\n${base}`,
    `Bonjour${h}.\nC’est ${agent}. ${base}\n\nDisponible si vous voulez qu’on finalise.`,
    `Bonsoir${h}.\n${base}\n\nToujours dispo de mon côté.`,
  ];
}

export function draftWhatsappFollowup(input: WhatsappFollowupInput): WhatsappFollowupDraft {
  const lang = input.lang ?? input.profile?.language ?? "fr";
  const focus = input.productFocus?.trim() || input.profile?.preferredProducts?.[0]?.trim() || input.profile?.primaryNeed?.trim() || "";
  const seed = input.seed ?? focus + input.agentName;

  const prospectForHonor = honorificProfile(input.profile);

  if (lang === "en") {
    const honor = englishHonorificSmart(prospectForHonor);
    const h = honor ? ` ${honor}` : "";
    const agent = input.agentName.trim() || "Advisor";
    const variants = [
      `Good evening${h}.\n${agent} from sales.\n\nFollowing up on ${focus || "your message from earlier"}.`,
      `Hi${h} — ${agent} here. Still available if you need anything on ${focus || "your request"}.`,
    ];
    return { body: pickFollowupVariant(seed, variants), kind: input.kind };
  }

  if (lang === "es") {
    const honor = spanishHonorificSmart(prospectForHonor);
    const h = honor ? ` ${honor}` : "";
    const variants = [
      `Buenas tardes${h}.\n${input.agentName} del equipo comercial.\n\nLe escribo por ${focus || "su consulta de ayer"}.`,
    ];
    return { body: pickFollowupVariant(seed, variants), kind: input.kind };
  }

  const honor = frenchHonorificSmart(prospectForHonor);
  const variants = variantsFr(input, honor, focus);
  return { body: pickFollowupVariant(seed, variants), kind: input.kind };
}

export function triggerToWhatsappKind(trigger: AutomationTriggerKind): WhatsappFollowupKind {
  switch (trigger) {
    case "closing_sequence":
      return "closing_ping";
    case "quotation_followup":
      return "quote_reminder";
    case "order_confirmation":
      return "order_confirmation";
    case "delivery_update":
      return "delivery_update";
    default:
      return "gentle_relaunch";
  }
}
