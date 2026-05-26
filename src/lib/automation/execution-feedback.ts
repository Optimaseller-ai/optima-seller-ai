/**
 * Formulations naturelles pour informer l’agent conversationnel du résultat réel d’une action.
 */

import type { AutomationLang } from "./types";
import type { ExecutionChannel } from "./execution-types";

export type LiveExecutionOutcome =
  | { kind: "sent_ok"; channel: ExecutionChannel; workflowKey?: string }
  | { kind: "queued_async"; channel: ExecutionChannel; workflowKey?: string }
  | { kind: "queued_human" }
  | { kind: "blocked"; reason: string }
  | { kind: "failed"; error?: string };

export function formatLiveExecutionFeedback(lang: AutomationLang | undefined, outcome: LiveExecutionOutcome): string {
  const l = lang ?? "fr";
  if (outcome.kind === "queued_async") {
    if (l === "en") return "I’m pushing that through on our side now.";
    if (l === "es") return "Lo estoy gestionando desde aquí ahora.";
    return "Je fais suivre ça de mon côté tout de suite.";
  }
  if (outcome.kind === "sent_ok") {
    if (l === "en") {
      if (outcome.channel === "email") return "I’ve just sent you the details.";
      if (outcome.channel === "whatsapp") return "I’ve dropped you the info on WhatsApp.";
      return "It’s sent on my side.";
    }
    if (l === "es") {
      if (outcome.channel === "email") return "Acabo de enviarle los detalles por correo.";
      if (outcome.channel === "whatsapp") return "Le acabo de pasar la info por WhatsApp.";
      return "Listo, enviado.";
    }
    if (outcome.channel === "email") return "Je viens de vous envoyer les détails.";
    if (outcome.channel === "whatsapp") return "Je vous ai envoyé ça sur WhatsApp.";
    return "C’est parti de mon côté.";
  }
  if (outcome.kind === "queued_human") {
    if (l === "en") return "I’m waiting on a quick validation from our team before sending.";
    if (l === "es") return "Estoy esperando una validación rápida del equipo antes de enviar.";
    return "Je dois avoir une petite validation équipe avant d’envoyer ça.";
  }
  if (outcome.kind === "blocked") {
    if (l === "en") return "I’m holding off for now — timing rules on our side.";
    if (l === "es") return "Prefiero esperar un momento por las reglas de envío.";
    return "Je préfère éviter d’insister là tout de suite.";
  }
  if (l === "en") return "I’m hitting a small sending issue on my side — I’ll fix it.";
  if (l === "es") return "Tengo un pequeño problema de envío ahora mismo.";
  return "Je rencontre un petit souci d’envoi de mon côté, je régle ça.";
}
