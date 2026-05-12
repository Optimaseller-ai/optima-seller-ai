import { detectSellerIntent } from "@/lib/agents/sales/intent-detection";
import { mergeCommercialMemory } from "@/lib/agents/memory/commercial-memory";
import { buildProfileMemoryLines, mergeConversationProfile, extractProductHintsFromMessage } from "@/lib/agents/memory/conversation-profile";
import { inferProspectGenderSignals } from "@/lib/agents/memory/prospect-identity-detector";
import {
  detectProspectExplicitFrenchGreeting,
  mergeProspectProfileFromUserMessage,
} from "@/lib/agents/memory/prospect-profile";
import type {
  ConversationalEtiquette,
  ProductMemory,
  SellerBehaviorConversationState,
  SellerIntent,
} from "@/lib/agents/memory/conversation-state";

function asPartialState(raw: unknown): SellerBehaviorConversationState {
  if (!raw || typeof raw !== "object") return {};
  return raw as SellerBehaviorConversationState;
}

function containsEmoji(text: string) {
  return /[\p{Extended_Pictographic}]/u.test(text);
}

function mergeProductMemory(prev: ProductMemory | undefined, message: string, intent: SellerIntent): ProductMemory {
  const hints = extractProductHintsFromMessage(message);
  const viewed = [...hints, ...(prev?.viewedProducts ?? [])].filter(Boolean);
  const uniq = Array.from(new Map(viewed.map((x) => [x.toLowerCase(), x])).values()).slice(0, 12);

  let budgetHint = prev?.budgetHint;
  const bud = message.match(/(\d{2,7})\s*(k|fcfa|cfa|€|eur)/i);
  if (bud?.[0]) budgetHint = bud[0].replace(/\s+/g, " ");

  let lastMentionedInterest = prev?.lastMentionedInterest;
  if (intent === "stock_inquiry" || intent === "price_inquiry" || intent === "purchase_intent") {
    const snip = message.trim().slice(0, 60);
    if (snip) lastMentionedInterest = snip;
  }

  return { viewedProducts: uniq, budgetHint, lastMentionedInterest };
}

/**
 * Fusionne l’état comportemental après un message utilisateur (avant génération IA).
 */
export function mergeSellerBehaviorStateForUserTurn(args: {
  previous: unknown;
  message: string;
}): { state: SellerBehaviorConversationState; intent: SellerIntent } {
  const prev = asPartialState(args.previous);
  const intent = detectSellerIntent(args.message);
  const conversationProfile = mergeConversationProfile({
    prev: prev.conversationProfile,
    message: args.message,
    intent,
  });

  const profileLines = buildProfileMemoryLines(conversationProfile, intent);
  const baseMemory = Array.isArray(prev.memory) ? prev.memory.map(String) : [];
  const stripped = baseMemory.filter(
    (l) =>
      !l.startsWith("Profil prospect:") &&
      !l.startsWith("Intention message:") &&
      !l.startsWith("Produits / modèles évoqués:") &&
      !l.startsWith("Style de langage à privilégier:"),
  );
  const memory = [...profileLines, ...stripped].slice(0, 20);

  const productMemory = mergeProductMemory(prev.productMemory, args.message, intent);
  let commercialMemory = mergeCommercialMemory({ prev: prev.commercialMemory, message: args.message, intent });
  if (productMemory.budgetHint) commercialMemory = { ...commercialMemory, budgetNotes: productMemory.budgetHint };

  let { profile: prospectProfile, changed: prospectChanged } = mergeProspectProfileFromUserMessage(
    prev.prospectProfile,
    args.message,
  );

  const genderSig = inferProspectGenderSignals(args.message, prospectProfile);
  if (prospectProfile.civility === "monsieur") {
    prospectProfile = { ...prospectProfile, inferredGender: "male", genderConfidence: 100 };
  } else if (prospectProfile.civility === "madame" || prospectProfile.civility === "mademoiselle") {
    prospectProfile = { ...prospectProfile, inferredGender: "female", genderConfidence: 100 };
  } else {
    const prevConf = prospectProfile.genderConfidence ?? 0;
    const nextConf = Math.max(prevConf, genderSig.genderConfidence);
    const nextInferred =
      genderSig.genderConfidence >= prevConf && genderSig.inferredGender !== "unknown"
        ? genderSig.inferredGender
        : prospectProfile.inferredGender ?? "unknown";
    prospectProfile = {
      ...prospectProfile,
      inferredGender: nextInferred,
      genderConfidence: nextConf,
    };
  }

  const prospectMem: string[] = [];
  if (prospectChanged.civility) {
    const label =
      prospectProfile.civility === "monsieur"
        ? "Monsieur"
        : prospectProfile.civility === "madame"
          ? "Madame"
          : prospectProfile.civility === "mademoiselle"
            ? "Mademoiselle"
            : null;
    if (label) prospectMem.push(`Civilité prospect (à utiliser): ${label}.`);
  }
  if (prospectChanged.displayName && prospectProfile.displayName) {
    prospectMem.push(`Prénom / nom prospect: ${prospectProfile.displayName}.`);
  }
  if (prospectChanged.habits && prospectProfile.habits.length) {
    prospectMem.push(`Habitudes: ${prospectProfile.habits.slice(0, 3).join(" ")}`);
  }

  const memoryWithProspect = [...prospectMem, ...memory].slice(0, 20);

  const explicitFrGreeting = detectProspectExplicitFrenchGreeting(args.message);
  const greetedNow =
    intent === "greeting" || explicitFrGreeting !== null || /\b(bonjour|bonsoir)\b/i.test(String(args.message ?? ""));

  const prevTurn = typeof prev.stats?.turn_count === "number" ? prev.stats.turn_count : 0;
  const nextTurn = prevTurn + 1;

  const etiquettePrev = prev.conversationalEtiquette ?? {};
  const prospectEverSentGreeting =
    etiquettePrev.prospectEverSentGreeting === true || greetedNow === true;

  const conversationalEtiquette: ConversationalEtiquette = {
    ...etiquettePrev,
    prospectEverSentGreeting,
  };

  const state = {
    ...prev,
    conversationProfile,
    lastSellerIntent: intent,
    memory: memoryWithProspect,
    productMemory,
    commercialMemory,
    prospectProfile,
    conversationalEtiquette,
    stats: {
      ...prev.stats,
      turn_count: nextTurn,
      last_active_at: Date.now(),
    },
  } as SellerBehaviorConversationState;

  return { state, intent };
}

/**
 * Enrichit la mémoire court terme après réponse assistant (sujets récents).
 */
export function mergeSellerBehaviorStateAfterAssistant(args: {
  state: SellerBehaviorConversationState;
  assistantReply: string;
}): SellerBehaviorConversationState {
  const snippet = String(args.assistantReply ?? "")
    .trim()
    .slice(0, 100)
    .replace(/\s+/g, " ");
  const mem = Array.isArray(args.state.memory) ? [...args.state.memory] : [];
  const withoutLastAssistant = mem.filter((l) => !l.startsWith("Dernier envoi conseiller:"));
  if (snippet) withoutLastAssistant.unshift(`Dernier envoi conseiller: ${snippet}`);

  const etiquettePrev = args.state.conversationalEtiquette ?? {};
  let repliesSince =
    typeof etiquettePrev.repliesSinceLastEmoji === "number" ? etiquettePrev.repliesSinceLastEmoji : 7;
  const presentationDone =
    etiquettePrev.businessPresentationDone === true ||
    (/\bje\s+suis\b/i.test(args.assistantReply) && /\bchez\b/i.test(args.assistantReply));
  if (containsEmoji(args.assistantReply)) repliesSince = 0;
  else repliesSince = Math.min(repliesSince + 1, 64);

  const conversationalEtiquette: ConversationalEtiquette = {
    ...etiquettePrev,
    businessPresentationDone: presentationDone,
    repliesSinceLastEmoji: repliesSince,
  };

  return { ...args.state, memory: withoutLastAssistant.slice(0, 20), conversationalEtiquette };
}
