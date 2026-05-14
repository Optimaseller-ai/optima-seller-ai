import "server-only";

import { isProspectGreetingMessage } from "@/lib/agents/human-behavior/conversation-state-engine";
import type { ProspectProfile } from "@/lib/agents/memory/prospect-profile";
import {
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
} from "@/lib/agents/memory/prospect-profile";
import { norm, detectDominantLanguage, type SellerLanguage } from "@/lib/agents/seller-language";
import { maybeHumanMicroPrefix } from "@/lib/agents/human-behavior/conversation/micro-behaviors";
import { maybeSplitAssistantMessage } from "@/lib/agents/human-behavior/conversation/message-splitting";

/** Intention du dernier message prospect (orchestration UX, distinct de SellerIntent). */
export type ProspectTurnIntent =
  | "salutation"
  | "question_personnelle"
  | "demande_produit"
  | "plainte"
  | "objection"
  | "achat"
  | "confusion"
  | "simple_discussion"
  | "hors_sujet";

const SALES_PUSH_FR =
  /\b(quel\s+modèle|commander|commande|souhaitez[- ]vous|souhaite[- ]tu|vous\s+souhaitez|stock|dispo|disponible|prix|fcfa|cfa|€|eur|catalogue|panier|réserver|réservez|passer\s+commande|je\s+vous\s+propose\s+un\s+modèle|puis-je\s+quand\s+même|quand\s+même\s+vous\s+proposer|je\s+vous\s+propose\s+quand\s+même)\b/i;
const SALES_PUSH_EN =
  /\b(which\s+model|place\s+an?\s+order|order\s+now|in\s+stock|available|price|checkout|cart|reserve|may\s+i\s+still\s+offer|still\s+offer\s+you)\b/i;
const SALES_PUSH_ES =
  /\b(qu[eé]\s+modelo|hacer\s+pedido|pedido|en\s+stock|disponible|precio|pagar|carrito|reservar|cat[aá]logo)\b/i;

const HOLD_OR_CHECK_FR = /\b(je\s+regarde|je\s+vérifie|un\s+instant|deux\s+minutes|attendez)\b/i;
const HOLD_OR_CHECK_EN = /\b(let\s+me\s+check|one\s+moment|just\s+a\s+sec|hold\s+on)\b/i;
const HOLD_OR_CHECK_ES = /\b(un\s+momento|d[eé]jeme\s+verificar|estoy\s+verificando|espera)\b/i;

export function isPersonalWellbeingTurn(message: string): boolean {
  return isPurePersonalWellbeingQuestion(norm(message).toLowerCase());
}

function isPurePersonalWellbeingQuestion(t: string): boolean {
  if (
    !/\b(comment\s+tu\s+vas|comment\s+vas[- ]tu|comment\s+allez[- ]vous|comment\s+ça\s+va|comment\s+ca\s+va|ça\s+va|ca\s+va|tu\s+vas\s+bien|vous\s+allez\s+bien|tu\s+vas\s+comment|vous\s+allez\s+comment|how\s+are\s+you|you\s+alright|you\s+ok|cómo\s+está|cómo\s+estás|cómo\s+te\s+va|qué\s+tal|que\s+tal)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (SALES_PUSH_FR.test(t) || SALES_PUSH_EN.test(t) || SALES_PUSH_ES.test(t)) return false;
  if (/\b(prix|stock|nike|iphone|livraison|commande|dispo|precio|env[ií]o|pedido|zapatillas)\b/i.test(t)) return false;
  return true;
}

function canonicalPersonalFr(honor: string | null): string {
  if (honor) return `Je vais bien merci ${honor}. J’espère que vous allez bien également.`;
  return "Je vais bien merci. J’espère que vous allez bien également.";
}

function canonicalPersonalEn(honor: "sir" | "madam" | null): string {
  if (honor === "sir") return "I’m well, thank you sir — I hope you’re doing well too.";
  if (honor === "madam") return "I’m well, thank you madam — I hope you’re doing well too.";
  return "I’m well, thanks — hope you’re doing well too.";
}

function canonicalPersonalEs(honor: "Señor" | "Señora" | null): string {
  if (honor) return `Muy bien, gracias ${honor}. Espero que usted también esté bien.`;
  return "Muy bien, gracias. Espero que usted también esté bien.";
}

/** Réponse instantanée « comment tu vas ? » — une bulle, zéro vente (évite tout appel LLM). */
export function buildPersonalWellbeingQuickReply(args: {
  message: string;
  lang: SellerLanguage;
  agentName: string;
  businessName: string;
  prospectProfile?: ProspectProfile;
}): string {
  const raw = norm(args.message);
  const seed = raw + args.agentName;
  if (args.lang === "en") {
    const honor = englishHonorificSmart(args.prospectProfile);
    const variants = [
      canonicalPersonalEn(honor),
      honor ? `Doing well, thank you ${honor}. And you?` : "Doing well, thanks — and you?",
      `All good on my side, thanks. I hope you’re well too — I’m ${args.agentName} from ${args.businessName}.`,
    ];
    return variants[seed.length % variants.length]!;
  }
  if (args.lang === "es") {
    const honor = spanishHonorificSmart(args.prospectProfile);
    const variants = [
      canonicalPersonalEs(honor),
      honor ? `Muy bien, gracias ${honor}. ¿Y usted?` : "Muy bien, gracias. ¿Y usted?",
      `Todo bien por aquí, gracias. Espero que usted también — soy ${args.agentName} de ${args.businessName}.`,
    ];
    return variants[seed.length % variants.length]!;
  }
  const honorFr = frenchHonorificSmart(args.prospectProfile);
  const variants = [
    canonicalPersonalFr(honorFr),
    honorFr ? `Très bien merci ${honorFr}. Et vous ?` : "Très bien merci. Et vous ?",
    `Ça va bien merci — et vous, tout va bien de votre côté ?`,
  ];
  return variants[seed.length % variants.length]!;
}

/**
 * Détection heuristique du sens principal du message (un seul rôle par tour pour l’orchestrateur).
 */
export function detectProspectTurnIntent(message: string): ProspectTurnIntent {
  const raw = String(message ?? "").trim();
  const t = norm(raw).toLowerCase();
  if (!t) return "simple_discussion";

  if (/\b(météo|meteo|politique|match\s+de|score\s+du|who\s+won)\b/i.test(t)) return "hors_sujet";

  if (/\b(je\s+prends|je\s+commande|je\s+veux\s+l['’']?acheter|je\s+r[eè]gle|i['’']?ll\s+take\s+it|i\s+want\s+to\s+buy)\b/i.test(t)) return "achat";

  if (/\b(arnaque|scam|réclamation|réclamer|plainte|honte|inadmissible|tribunal|police)\b/i.test(t)) return "plainte";

  if (/\b(trop\s+cher|pas\s+cher|hésit|hésite|pas\s+convaincu|pas\s+sûr\s+d['’']?acheter)\b/i.test(t)) return "objection";

  if (/\b(je\s+comprends\s+pas|pas\s+clair|c['’']?est\s+quoi\s+exactement|expliquez|i\s+don['’']?t\s+understand)\b/i.test(t)) return "confusion";

  if (isPurePersonalWellbeingQuestion(t)) return "question_personnelle";

  if (isProspectGreetingMessage(raw)) return "salutation";

  if (
    /\b(avez[- ]vous|as[- ]tu|tu\s+as|vous\s+avez|il\s+y\s+a|y\s+a[- ]t[- ]?il|c['’']?est\s+combien|combien\s+ça|prix\s+du|stock|dispo|disponible|modèle|iphone|samsung|nike|adidas|article|tienen|tiene|hay|precio|disponible|zapatillas)\b/i.test(
      t,
    )
  ) {
    return "demande_produit";
  }

  return "simple_discussion";
}

/** Bloc « mode commercial actif » : seulement si le tour porte sur l’achat / le produit / une objection marchande. */
export function salesOpportunityAllowedForIntent(intent: ProspectTurnIntent): boolean {
  return intent === "demande_produit" || intent === "achat" || intent === "objection" || intent === "confusion";
}

export function intentAllowsMicroPrefix(intent: ProspectTurnIntent): boolean {
  return intent === "demande_produit" || intent === "achat" || intent === "objection" || intent === "confusion" || intent === "plainte";
}

export function maxChunksForIntent(intent: ProspectTurnIntent): 1 | 2 {
  if (
    intent === "question_personnelle" ||
    intent === "salutation" ||
    intent === "simple_discussion" ||
    intent === "hors_sujet" ||
    intent === "plainte"
  ) {
    return 1;
  }
  return 2;
}

function stripSalesSentences(text: string, lang: SellerLanguage): string {
  const push = lang === "en" ? SALES_PUSH_EN : lang === "es" ? SALES_PUSH_ES : SALES_PUSH_FR;
  const sentences = String(text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter((s) => !push.test(s));
  return kept.join(" ").trim();
}

function stripHoldNoiseWhenInappropriate(text: string, intent: ProspectTurnIntent, lang: SellerLanguage): string {
  if (intent !== "question_personnelle" && intent !== "salutation" && intent !== "simple_discussion") return text;
  const re = lang === "en" ? HOLD_OR_CHECK_EN : lang === "es" ? HOLD_OR_CHECK_ES : HOLD_OR_CHECK_FR;
  const sentences = String(text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter((s) => !re.test(s));
  return kept.join(" ").trim();
}

/**
 * « Un vrai humain sur WhatsApp ? » — réparation sans second appel LLM.
 */
export function validateHumanSingleTopicReply(args: { reply: string; intent: ProspectTurnIntent; lang: SellerLanguage }): {
  ok: boolean;
  repaired?: string;
} {
  const reply = String(args.reply ?? "").trim();
  if (!reply)
    return {
      ok: false,
      repaired:
        args.lang === "en" ? "Thanks for your message." : args.lang === "es" ? "Gracias por su mensaje." : "Merci pour votre message.",
    };

  if (args.intent === "question_personnelle") {
    const noSales = stripSalesSentences(reply, args.lang);
    const noHold = stripHoldNoiseWhenInappropriate(noSales, args.intent, args.lang);
    const cleaned = noHold.trim();
    if (!cleaned || SALES_PUSH_FR.test(cleaned) || SALES_PUSH_EN.test(cleaned) || SALES_PUSH_ES.test(cleaned)) {
      return {
        ok: false,
        repaired:
          args.lang === "en" ? canonicalPersonalEn(null) : args.lang === "es" ? canonicalPersonalEs(null) : canonicalPersonalFr(null),
      };
    }
    if (cleaned.length < reply.length * 0.55) return { ok: false, repaired: cleaned };
    return { ok: true, repaired: cleaned };
  }

  if (args.intent === "salutation" || args.intent === "simple_discussion") {
    const noSales = stripSalesSentences(reply, args.lang);
    const cleaned = stripHoldNoiseWhenInappropriate(noSales, args.intent, args.lang).trim();
    if (SALES_PUSH_FR.test(cleaned) || SALES_PUSH_EN.test(cleaned) || SALES_PUSH_ES.test(cleaned)) {
      return {
        ok: false,
        repaired:
          args.lang === "en" ? "Thanks for your message." : args.lang === "es" ? "Gracias por su mensaje." : "Merci pour votre message.",
      };
    }
    if (cleaned.length < 8) return { ok: false, repaired: reply };
    return { ok: true, repaired: cleaned };
  }

  return { ok: true, repaired: reply };
}

export type OrchestrateHumanReplyInput = {
  lastUserMessage: string;
  /** Texte déjà filtré anti-IA + adouci + forme courte + emoji */
  draftText: string;
  microSeed: string;
  repliesSinceLastEmoji: number;
  /** Langue conversationnelle persistée (meilleure détection FR/EN). */
  stateLanguage?: SellerLanguage;
};

/**
 * Une seule intention → une seule réponse cohérente : pas de préfixe « pardon » hors contexte,
 * découpe max 1–2 bulles selon l’intention, retrait des phrases vente hors-sujet.
 */
export function orchestrateHumanReply(input: OrchestrateHumanReplyInput): { text: string; messagePlan: string[] } {
  const intent = detectProspectTurnIntent(input.lastUserMessage);
  const lang = detectDominantLanguage({ message: input.lastUserMessage, previous: input.stateLanguage });

  let text = String(input.draftText ?? "").trim();

  const validated = validateHumanSingleTopicReply({ reply: text, intent, lang });
  text = validated.repaired ?? text;

  const allowMicro = intentAllowsMicroPrefix(intent);
  text = allowMicro ? maybeHumanMicroPrefix(text, input.microSeed) : text;

  const maxChunks = maxChunksForIntent(intent);
  let plan = maybeSplitAssistantMessage(text, input.microSeed, maxChunks);
  if (plan.length > maxChunks) plan = plan.slice(0, maxChunks);

  if (maxChunks === 1 && plan.length > 1) {
    text = plan.join(" ").replace(/\s+/g, " ").trim();
    plan = [text];
  } else {
    text = plan.join("\n\n");
  }

  return { text, messagePlan: plan };
}

export function formatTurnIntentOrchestratorBlock(intent: ProspectTurnIntent, lang: SellerLanguage): string | null {
  if (lang === "en") {
    if (intent === "question_personnelle") {
      return [
        "ORCHESTRATION (CRITICAL): TURN INTENT = personal / wellbeing.",
        "- Reply with ONE coherent short message only (max 2 tiny sentences).",
        "- No product pitch, no stock/price, no “which model”, no “how can I help you shop”.",
        "- No fake “I’m checking” lines unless they truly asked for a lookup.",
      ].join("\n");
    }
    if (intent === "salutation" || intent === "simple_discussion") {
      return [
        "ORCHESTRATION (CRITICAL): social / greeting tone only this turn.",
        "- One coherent message. Do not stack unrelated sentences (no wellbeing + checking + sales).",
        "- Do not push ordering unless they already asked about a product this turn.",
      ].join("\n");
    }
    return null;
  }

  if (lang === "es") {
    if (intent === "question_personnelle") {
      return [
        "ORQUESTACIÓN (CRÍTICA): intención del turno = personal / bienestar.",
        "- Una sola respuesta coherente y breve (máx. 2 frases cortas).",
        "- Prohibido: pitch de producto, stock/precio, «qué modelo», «qué desea comprar».",
        "- Prohibido: «estoy verificando» si el prospecto no pidió una consulta.",
      ].join("\n");
    }
    if (intent === "salutation" || intent === "simple_discussion") {
      return [
        "ORQUESTACIÓN (CRÍTICA): tono social / saludo en este turno.",
        "- Un solo mensaje fluido: no acumular mini-respuestas (bienestar + «verifico» + venta).",
        "- No empujar la compra si no mencionaron un producto en este mensaje.",
      ].join("\n");
    }
    return null;
  }

  if (intent === "question_personnelle") {
    return [
      "ORCHESTRATION (CRITIQUE) : intention du tour = question personnelle / forme de politesse.",
      "- UNE seule réponse cohérente (1 à 2 très courtes phrases maximum).",
      "- Interdit : parler produit, stock, prix, commande, « quel modèle », « que souhaitez-vous commander ».",
      "- Interdit : enchaîner « je regarde / je vérifie » sans demande de vérification du prospect.",
    ].join("\n");
  }
  if (intent === "salutation" || intent === "simple_discussion") {
    return [
      "ORCHESTRATION (CRITIQUE) : tour social / politesse.",
      "- Un seul message fluide : pas d’empilement de mini-réponses (pas wellbeing + « je regarde » + vente).",
      "- Pas de relance commande si le prospect n’a pas évoqué un produit dans ce message.",
    ].join("\n");
  }
  return null;
}
