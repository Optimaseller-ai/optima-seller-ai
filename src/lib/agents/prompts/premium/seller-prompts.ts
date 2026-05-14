import "server-only";

import { DateTime } from "luxon";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { agentBehaviorPromptFr } from "@/lib/agents/personality/persona-prompts";
import { formatBusinessLocalDateTime } from "@/lib/agents/timing/business-timezone";
import {
  detectProspectExplicitFrenchGreeting,
  formatProspectProfilePromptBlock,
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
  greetingSlotFromLocalHour,
  resolveFrenchOpeningPhrase,
} from "@/lib/agents/memory/prospect-profile";
import { ANTI_AI_PHRASE_BLACKLIST } from "@/lib/agents/human-behavior/anti-ai/phrase-blacklist";
import {
  buildConversationStateEngineSnapshot,
  formatConversationStateEnginePromptBlock,
  tryHumanizedGreetingQuickReply,
} from "@/lib/agents/human-behavior/conversation-state-engine";
import { runHumanResponseEngine } from "@/lib/agents/human-behavior/human-response-engine";
import {
  buildPersonalWellbeingQuickReply,
  detectProspectTurnIntent,
  formatTurnIntentOrchestratorBlock,
  isPersonalWellbeingTurn,
  type ProspectTurnIntent,
} from "@/lib/agents/human-behavior/response-orchestrator";
import { detectDominantLanguage, norm, type SellerLanguage } from "@/lib/agents/seller-language";
import {
  formatEmotionalTemperaturePromptBlock,
  inferConversationEmotionalTemperature,
  type SellerPromptLangHint,
} from "@/lib/agents/human-behavior/emotions/conversation-emotion";

export type { SellerLanguage } from "@/lib/agents/seller-language";
export { detectDominantLanguage, norm } from "@/lib/agents/seller-language";

const MULTILINGUAL_CORE_RULES = [
  "LANGUAGE ADAPTATION (mandatory):",
  "You automatically adapt to the customer language.",
  "You reply naturally in French, English or Spanish depending on the conversation.",
  "Never say you only speak French.",
  "Never mention AI limitations.",
  "Speak like a real commercial advisor — warm, credible, modern African startup tone — never a translation robot.",
].join("\n");

type Role = "user" | "assistant";

function recentChatForLang(ctx: PremiumSellerContext): Array<{ role: Role; content: string }> {
  const h = ctx.history ?? [];
  return [...h, { role: "user" as const, content: ctx.message }];
}

export type PremiumSellerProfile = {
  agentName: string;
  businessName: string;
  sector?: string;
  city?: string;
  country?: string;
  agentPersonality?: "chaleureux" | "professionnel" | "dynamique";
  salesStyle?: "conseiller" | "closer" | "premium";
  /** Poste affiché (ex. Service client) */
  agentRole?: string;
  /** Ton narratif court (ex. calme rassurante) */
  agentTone?: string;
  /** Fuseau IANA du commerce (ville/pays profil) — heure « employé sur place » */
  businessIanaTimezone?: string;
};

export type PremiumSellerContext = {
  message: string;
  history: Array<{ role: Role; content: string }>;
  /** Après un message « je vérifie » : réponse concrète attendue */
  followupAfterHold?: boolean;
  conversationState?: SellerBehaviorConversationState;
  /** persona_key agent (bryan, vanessa, … — alias DB : lucas→bryan, mark→brice) */
  personaKey?: string | null;
  productsText?: string; // already formatted list
  chunksText?: string; // already formatted excerpts
  /** Bloc injecté par `runSalesOpportunityEngine` (vente active) — peut être absent si tour non commercial */
  salesOpportunityBlock?: string;
  /** Intention tour prospect (orchestrateur — une seule réponse cohérente) */
  prospectTurnIntent?: ProspectTurnIntent;
};

function isBareAck(msg: string) {
  const m = norm(msg).toLowerCase();
  return /^(ok|okay|k|d['’]accord|dac|bien|parfait|merci|mercii|cool|hmm+|mm+|thanks|thank you|thx|👍|👌|🙏)$/i.test(m);
}

function isWhoAreYou(msg: string) {
  const m = norm(msg).toLowerCase();
  return /(vous êtes qui|tu es qui|c['’]est qui|qui parle|qui êtes[- ]vous|qui es[- ]tu|who are you|who is this|who am i talking to)/i.test(m);
}

function isWhoDoYouWorkFor(msg: string) {
  const m = norm(msg).toLowerCase();
  return /(vous travaillez pour qui|tu travailles pour qui|c['’]est quelle entreprise|vous êtes de quelle boutique|vous êtes chez qui|c['’]est (?:yuri|la boutique) ?\??)/i.test(
    m,
  );
}

function isTimeQuestion(msg: string) {
  const m = norm(msg).toLowerCase();
  return /(il est quelle heure|c['’]est quelle heure|quelle heure|il est tard|on est quelle heure|what time is it|what's the time|whats the time|is it late)/i.test(m);
}

function businessNow(profile: PremiumSellerProfile): DateTime {
  const zone = String(profile.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const dt = DateTime.now().setZone(zone);
  return dt.isValid ? dt : DateTime.now().setZone("Africa/Douala");
}

function detectProspectTone(message: string, history: Array<{ role: Role; content: string }>) {
  const recentUser = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");
  const text = `${recentUser} ${message}`.toLowerCase();

  const angry =
    /(nul|arnaque|scam|mensonge|marre|😠|😡|🤬|je suis pas content|pas content|c'est quoi ça|c est quoi ca|erreurs|trompez|trompé|trompe|incohérent)/i.test(text);
  const joking = /(mdr|lol|haha|😂|🤣|😄|😆|😅|😉)/i.test(text);
  const rushed =
    /(\b(prix|combien|dispo|stock|where|when|price|available)\b|\burgent\b|\bvite\b|\bnow\b|\basap\b)/i.test(text) || norm(message).length <= 8;
  if (angry) return "angry" as const;
  if (joking) return "joking" as const;
  if (rushed) return "rushed" as const;
  return "neutral" as const;
}

function detectOffTopic(message: string) {
  const m = norm(message).toLowerCase();
  if (/(vous mangez|tu manges|on mange|quoi ce soir|ce soir tu manges|you eating|what are you eating|dinner|what’s for dinner|qué\s+cenas|qué\s+vas\s+a\s+comer)/i.test(m))
    return "food";
  if (/(ça va|ca va|how are you|you good|you ok|cómo\s+está|cómo\s+estás|qué\s+tal|que\s+tal)/i.test(m)) return "smalltalk";
  return null;
}

function microReactionPack(lang: SellerLanguage) {
  if (lang === "en") return ["Right.", "Okay.", "I see.", "Alright.", "Sure.", "Just a sec, I’m checking."];
  if (lang === "es") return ["Vale.", "De acuerdo.", "Le entiendo.", "Claro.", "Un momento, estoy mirando eso."];
  return ["Ah oui.", "Je vois.", "D’accord.", "Effectivement.", "Oui possible.", "Attendez je regarde."];
}

function connectorsPack(lang: SellerLanguage) {
  if (lang === "en") return ["So,", "In that case,", "But", "Honestly,", "Alright then,"];
  if (lang === "es") return ["Entonces,", "En ese caso,", "Pero", "Sinceramente,", "Bueno,"];
  return ["Alors,", "Dans ce cas,", "Par contre,", "Honnêtement,", "Du coup,"];
}

function pickOne<T>(items: T[], seed: string) {
  // deterministic-ish by message seed (no crypto dependency)
  const s = seed || "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

const BUSINESS_MEMORY_MAX_CHARS = 1200;

function truncateMemoryLines(rawLines: string[], maxChars: number): string[] {
  const out: string[] = [];
  let total = 0;
  for (const raw of rawLines) {
    const line = String(raw ?? "").trim();
    if (!line) continue;
    const sep = out.length ? 1 : 0;
    if (total + sep + line.length > maxChars) break;
    out.push(line);
    total += sep + line.length;
  }
  return out;
}

/** Réponse d’attente naturelle après échec IA (ne pas utiliser de formulations type « petite lenteur »). */
export function pickHoldReply(lang: SellerLanguage, seed: string): string {
  const fr = ["Je regarde cela Monsieur.", "Un instant s'il vous plaît.", "Je vérifie."];
  const en = ["One moment sir, I’m checking that for you.", "Just a moment.", "Let me check that."];
  const es = ["Un momento señor, estoy verificando eso.", "Un instante, por favor.", "Le confirmo en seguida."];
  return pickOne(lang === "en" ? en : lang === "es" ? es : fr, seed);
}

export function quickHumanReply(profile: PremiumSellerProfile, ctx: PremiumSellerContext): string | null {
  const message = norm(ctx.message);
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  const lang = detectDominantLanguage({
    message,
    previous: ctx.conversationState?.language,
    history: recentChatForLang(ctx),
  });

  if (isPersonalWellbeingTurn(message)) {
    return buildPersonalWellbeingQuickReply({
      message: ctx.message,
      lang,
      agentName: profile.agentName,
      businessName: profile.businessName,
      prospectProfile: ctx.conversationState?.prospectProfile,
    });
  }

  const greetingHit = tryHumanizedGreetingQuickReply(
    {
      agentName: profile.agentName,
      businessName: profile.businessName,
      sector: profile.sector,
      businessIanaTimezone: profile.businessIanaTimezone,
    },
    { message: ctx.message, history, conversationState: ctx.conversationState },
  );
  if (greetingHit) return greetingHit;

  if (isBareAck(message)) {
    const pp = ctx.conversationState?.prospectProfile;
    const hFr = frenchHonorificSmart(pp);
    const hEs = spanishHonorificSmart(pp);
    const variants =
      lang === "en"
        ? ["Alright.", "Perfect.", "Okay.", "Very well."]
        : lang === "es"
          ? hEs
            ? [`De acuerdo ${hEs}.`, "Muy bien.", "Perfecto.", "Queda anotado."]
            : ["De acuerdo.", "Muy bien.", "Perfecto.", "Queda anotado."]
          : hFr
            ? [`D’accord ${hFr}.`, "Très bien.", "Parfait.", "C’est bien noté."]
            : ["D’accord.", "Très bien.", "Parfait.", "C’est bien noté."];
    return pickOne(variants, message + (profile.agentName ?? ""));
  }

  if (isWhoAreYou(message)) {
    if (lang === "en") return `I’m ${profile.agentName} from ${profile.businessName}.`;
    if (lang === "es") return `Soy ${profile.agentName} del servicio al cliente de ${profile.businessName}.`;
    return `Je suis ${profile.agentName} du service client ${profile.businessName}.`;
  }

  if (isWhoDoYouWorkFor(message)) {
    if (lang === "en") return `I work with the ${profile.businessName} team.`;
    if (lang === "es") return `Trabajo con el equipo de ${profile.businessName}.`;
    return `Je travaille avec l’équipe ${profile.businessName}.`;
  }

  if (isTimeQuestion(message)) {
    const nowLocal = businessNow(profile);
    const hour = nowLocal.hour;
    const wall = nowLocal.toFormat("HH:mm");
    if (lang === "en") {
      if (hour >= 22 || hour < 5) return `It’s ${wall} here — pretty late.`;
      if (hour >= 18) return `It’s ${wall} here — evening already.`;
      return `It’s ${wall} here — still daytime.`;
    }
    if (lang === "es") {
      if (hour >= 22 || hour < 5) return `Aquí son las ${wall} — ya es tarde.`;
      if (hour >= 18) return `Aquí son las ${wall} — ya es por la noche.`;
      return `Aquí son las ${wall} — aún es de día.`;
    }
    if (hour >= 22 || hour < 5) return `Ici il est ${wall} — un peu tard.`;
    if (hour >= 18) return `Ici il est ${wall} — on est le soir.`;
    return `Ici il est ${wall} — journée encore.`;
  }

  const offTopic = detectOffTopic(message);
  if (offTopic === "food") {
    const variants =
      lang === "en"
        ? ["Haven’t thought about it yet.", "Good question.", "Not sure yet."]
        : lang === "es"
          ? ["Aún no lo he pensado.", "Buena pregunta.", "Todavía no lo sé."]
          : ["Je n’ai pas encore réfléchi.", "Bonne question.", "Je ne sais pas encore."];
    return pickOne(variants, message + profile.agentName);
  }

  return null;
}

export function buildPremiumSystemPrompt(profile: PremiumSellerProfile, ctx: PremiumSellerContext) {
  const toneMode = ctx.conversationState?.tone_mode ?? "conversation_naturelle";
  const blacklist = Array.isArray(ctx.conversationState?.preferences?.blacklist) ? ctx.conversationState!.preferences!.blacklist!.slice(0, 30) : [];
  const memory = truncateMemoryLines(
    Array.isArray(ctx.conversationState?.memory) ? ctx.conversationState!.memory!.map(String) : [],
    BUSINESS_MEMORY_MAX_CHARS,
  );
  const lang = detectDominantLanguage({
    message: ctx.message,
    previous: ctx.conversationState?.language,
    history: recentChatForLang(ctx),
  });
  const turnIntent = ctx.prospectTurnIntent ?? detectProspectTurnIntent(ctx.message);
  const orchestratorBlock = formatTurnIntentOrchestratorBlock(turnIntent, lang);
  const langHint: SellerPromptLangHint = lang === "es" ? "es" : lang === "en" ? "en" : "fr";
  const emotionalTemperature = inferConversationEmotionalTemperature(ctx.message);
  const emotionalTemperatureBlock = formatEmotionalTemperaturePromptBlock(emotionalTemperature, langHint);
  const fatigue = Math.max(0, Math.min(1, ctx.conversationState?.stats?.fatigue ?? 0));
  const nowLocal = businessNow(profile);
  const hour = nowLocal.hour;
  const minute = nowLocal.minute;
  const daySlot = greetingSlotFromLocalHour(hour, minute);
  const bucketLabel =
    lang === "en"
      ? daySlot === "morning"
        ? "morning"
        : daySlot === "afternoon"
          ? "afternoon"
          : daySlot === "evening"
            ? "evening"
            : "late night"
      : lang === "es"
        ? daySlot === "morning"
          ? "mañana"
          : daySlot === "afternoon"
            ? "tarde"
            : daySlot === "evening"
              ? "noche"
              : "madrugada"
        : daySlot === "morning"
          ? "matin"
          : daySlot === "afternoon"
            ? "après-midi"
            : daySlot === "evening"
              ? "soir"
              : "nuit";
  const prospectTone = detectProspectTone(ctx.message, ctx.history ?? []);
  const intent = ctx.conversationState?.lastSellerIntent;
  const prospectProfile = ctx.conversationState?.conversationProfile;
  const prospectIdentity = ctx.conversationState?.prospectProfile;
  const productMemory = ctx.conversationState?.productMemory;
  const regionStyle = ctx.conversationState?.regionStyle ?? "standard";
  const agentExtra = agentBehaviorPromptFr(ctx.personaKey ?? null);

  const iana = String(profile.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const localFmt = formatBusinessLocalDateTime({ iana, now: new Date() });
  const localClockLine = localFmt
    ? lang === "en"
      ? `LOCAL BUSINESS TIME (${profile.city ?? "—"}, ${profile.country ?? "—"} — ${iana}): ${localFmt.wallClock}.`
      : lang === "es"
        ? `HORA LOCAL TIENDA (${profile.city ?? "—"}, ${profile.country ?? "—"} — ${iana}): ${localFmt.wallClock}.`
        : `HEURE LOCALE BOUTIQUE (${profile.city ?? "—"}, ${profile.country ?? "—"} — fuseau ${iana}) : ${localFmt.wallClock}.`
    : null;

  const prospectIdentityBlock = formatProspectProfilePromptBlock(prospectIdentity, lang);

  const stateEngineBlock = formatConversationStateEnginePromptBlock(
    buildConversationStateEngineSnapshot({
      message: ctx.message,
      history: ctx.history ?? [],
      conversationState: ctx.conversationState,
      businessIanaTimezone: profile.businessIanaTimezone,
      businessName: profile.businessName,
      agentName: profile.agentName,
    }),
  );

  const explicitFrThisTurn = lang === "fr" ? detectProspectExplicitFrenchGreeting(ctx.message) : null;
  const resolvedOpeningFr =
    explicitFrThisTurn != null ? resolveFrenchOpeningPhrase({ nowLocal, explicitKind: explicitFrThisTurn }) : null;

  const temporalAwarenessFr = [
    "CONSCIENCE TEMPORELLE & SALUTATIONS (obligatoire):",
    "- Référence horaire : fuseau IANA + ville/pays du profil boutique ci-dessus ; l’horloge locale affichée prime pour savoir s’il fait jour ou soir.",
    "- Créneaux : matin 05h00–11h59 ; après-midi 12h00–17h59 ; soir 18h00–23h59 ; nuit 00h00–04h59.",
    "- Formules précises du prospect (« bonne après-midi », « bon matin ») : harmonisez-vous — surtout « bonne après-midi » → commencez par « Bonne après-midi Monsieur/Madame » ou « Merci Monsieur, bonne après-midi à vous également » ; ne basculez pas sur « Bonsoir » seul.",
    "- « bonjour » / « bonsoir » / « salut » génériques : si l’heure locale boutique suggère une autre salutation, utilisez-la avec naturel SANS corriger le prospect (« ce n’est pas bonjour » interdit). Ex. « Bonsoir Monsieur et bienvenue chez … ».",
    "- Si le message du prospect est une question ou un sujet produit : pas besoin de rouvrir par « Bonjour Monsieur » si vous avez déjà échangé dans le fil.",
    "- Fin de soirée / nuit : si « je passe maintenant », expliquer sobrement fermeture / délai et proposer un créneau tôt le lendemain — crédible, humain.",
    "- INTERDIT : promettre une action immédiate en pleine nuit locale si ce n’est pas réaliste pour une boutique.",
  ].join("\n");

  const temporalAwarenessEn = [
    "TIME & GREETINGS (mandatory):",
    "- Business timezone/city/country above is the clock reference.",
    "- Day parts (local): morning 05:00–11:59 ; afternoon 12:00–17:59 ; evening 18:00–23:59 ; night 00:00–04:59.",
    "- If they use a specific phrase like “good afternoon”, keep it consistent — don’t snap to “good evening” unless the overall tone benefits from a gentle blend.",
    "- If their generic greeting mismatches local time, prefer the correct greeting without lecturing them.",
    "- Late night pickup requests: politely set expectations and offer next-day morning — human, not scripted.",
  ].join("\n");

  const temporalAwarenessEs = [
    "TIEMPO Y SALUDOS (obligatorio):",
    "- La zona horaria / ciudad / país de la tienda arriba es la referencia.",
    "- Franjas locales: mañana 05:00–11:59 ; tarde 12:00–17:59 ; noche 18:00–23:59 ; madrugada 00:00–04:59.",
    "- Si el prospecto usa una fórmula concreta («buenas tardes»), mantenga coherencia — no cambie bruscamente a «buenas noches» sin necesidad.",
    "- Si el saludo genérico no encaja con la hora local, use el saludo correcto sin corregir al prospecto.",
    "- Pedidos muy tarde: marque expectativas con calidez y ofrezca continuar por la mañana — humano, no guion.",
  ].join("\n");

  const greetingHintFr =
    lang === "fr" && resolvedOpeningFr
      ? [
          "INDICATION SALUTATION (calculée pour ce message — si vous commencez par une salutation):",
          `- Formule attendue : « ${resolvedOpeningFr.phraseFr} » (${resolvedOpeningFr.strategy === "mirror_explicit" ? "cohérence avec le prospect" : "alignée sur l’heure locale boutique"}).`,
        ].join("\n")
      : null;

  const etiquette = ctx.conversationState?.conversationalEtiquette;
  const userTurnCount = ctx.conversationState?.stats?.turn_count ?? 0;
  const etiquettePromptFr =
    lang === "fr" &&
    etiquette &&
    ((etiquette.prospectEverSentGreeting === true && userTurnCount >= 2) || etiquette.businessPresentationDone === true)
      ? [
          "SOUVENIR DE CONVERSATION:",
          etiquette.prospectEverSentGreeting === true && userTurnCount >= 2
            ? "- Le prospect a déjà échangé une salutation dans ce fil : ne rouvrez pas chaque message par « Bonjour Monsieur » si le fond du message est une question ou un sujet."
            : null,
          etiquette.businessPresentationDone ? "- Une présentation « je suis … chez … » a déjà eu lieu : ne refaites pas une intro premier contact sauf demande." : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const lastAssistant = [...(ctx.history ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "";

  const personalityHint =
    profile.agentPersonality === "professionnel"
      ? "Calme, sobre, très crédible. Phrases courtes."
      : profile.agentPersonality === "dynamique"
        ? "Rapide, direct, fluide. Jamais adolescent."
        : "Chaleureux mais sobre. Pas d’excès.";

  const salesStyleHint =
    profile.salesStyle === "premium"
      ? "Conseiller boutique premium. Rassurer sans en faire trop."
      : profile.salesStyle === "closer"
        ? "Orienté action, mais subtil. Pas agressif."
        : "Conseiller naturel. Aide à choisir sans pousser.";

  const hardBans = [...ANTI_AI_PHRASE_BLACKLIST, ...blacklist].filter(Boolean);

  const identityExtra =
    profile.agentRole || profile.agentTone
      ? lang === "en"
        ? [
            profile.agentRole ? `You are ${profile.agentName}, ${profile.agentRole} at ${profile.businessName}.` : null,
            profile.agentTone ? `Personal tone to embody: ${profile.agentTone}.` : null,
            "Never say you are an AI, a bot, or an assistant.",
          ]
            .filter(Boolean)
            .join("\n")
        : lang === "es"
          ? [
              profile.agentRole ? `Usted es ${profile.agentName}, ${profile.agentRole} en ${profile.businessName}.` : null,
              profile.agentTone ? `Tono personal a encarnar: ${profile.agentTone}.` : null,
              "Nunca diga que es una IA, un bot o un asistente.",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              profile.agentRole
                ? `Vous êtes ${profile.agentName}, ${profile.agentRole} chez ${profile.businessName}.`
                : null,
              profile.agentTone ? `Ton à incarner: ${profile.agentTone}.` : null,
              "Ne dites jamais que vous êtes une IA, un bot ou un assistant.",
            ]
              .filter(Boolean)
              .join("\n")
      : null;

  const followupHold =
    ctx.followupAfterHold === true
      ? lang === "en"
        ? "CRITICAL FOLLOW-UP: You already told the prospect you were checking. They are still waiting. Now give a CONCRETE answer: product name, price in FCFA if in catalogue, stock if known. 1–2 short sentences. Do NOT say again that you are checking or ask what they need."
        : lang === "es"
          ? "SEGUIMIENTO CRÍTICO: Ya dijo que estaba verificando. El prospecto sigue esperando. Dé ahora una respuesta CONCRETA: nombre del producto, precio en FCFA si está en catálogo, stock si aplica. 1–2 frases cortas. NO repita «estoy verificando» ni pregunte qué necesita sin aportar datos."
          : "SUIVI CRITIQUE: Vous avez déjà dit que vous vérifiez. Le prospect attend. Donnez maintenant une réponse CONCRÈTE: nom produit, prix en FCFA si dans le catalogue, dispo/stock si pertinent. 1–2 phrases courtes. Ne redites pas « je vérifie » et ne posez pas « que recherchez-vous ». Ensuite, une micro-prochaine étape naturelle (ex. envoi des infos livraison, réservation soft) si pertinent — sans insistance."
      : null;

  const intentBlockEn =
    intent != null
      ? [
          "DETECTED INTENT (adapt tone + goal; stay human, short):",
          `- intent: ${intent}`,
          prospectProfile
            ? `- prospect profile: tone=${prospectProfile.tone}, interest=${prospectProfile.interestLevel}, buyingIntent≈${prospectProfile.buyingIntent}, languageStyle=${prospectProfile.preferredLanguageStyle}`
            : null,
          productMemory?.viewedProducts?.length
            ? `- products mentioned before: ${productMemory.viewedProducts.join(", ")}`
            : null,
          productMemory?.budgetHint ? `- budget hint: ${productMemory.budgetHint}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const intentBlockEs =
    intent != null
      ? [
          "INTENCIÓN DETECTADA (adaptar tono + objetivo; humano y breve):",
          `- intención: ${intent}`,
          prospectProfile
            ? `- perfil: tono=${prospectProfile.tone}, interés=${prospectProfile.interestLevel}, intención de compra≈${prospectProfile.buyingIntent}, estilo=${prospectProfile.preferredLanguageStyle}`
            : null,
          productMemory?.viewedProducts?.length
            ? `- productos ya mencionados: ${productMemory.viewedProducts.join(", ")}`
            : null,
          productMemory?.budgetHint ? `- pista de presupuesto: ${productMemory.budgetHint}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const intentBlockFr =
    intent != null
      ? [
          "INTENTION DÉTECTÉE (adapter ton + objectif; rester humain et court):",
          `- intention: ${intent}`,
          prospectProfile
            ? `- profil prospect: ton=${prospectProfile.tone}, intérêt=${prospectProfile.interestLevel}, intention achat≈${prospectProfile.buyingIntent}, style langage=${prospectProfile.preferredLanguageStyle}`
            : null,
          productMemory?.viewedProducts?.length
            ? `- produits déjà évoqués: ${productMemory.viewedProducts.join(", ")}`
            : null,
          productMemory?.budgetHint ? `- budget évoqué: ${productMemory.budgetHint}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  const antiChatGptFr = [
    "ANTI-CHATGPT (strict):",
    "- Pas de tutoiement commercial artificiel, pas de ton « coach » ni « consultant digital ».",
    "- Pas de listes numérotées type FAQ, pas de sur-explication, pas de phrases « parfaites » longues.",
    "- Jamais « en tant qu’assistant », jamais mention d’IA.",
    "- Varier les tournures; éviter les formules marketing creuses.",
    "- Si le prospect est agacé ou vous reproche des erreurs : reconnaissance courte et sincère (« vous avez raison », « merci pour votre retour ») puis réponse au fond — interdit d’enchaîner seul sur « comment puis-je vous aider ».",
    "- Pour avancer sans robot : « Je vous écoute », « Quel modèle vous intéresse ? », « Une fourchette de budget ? » — alternez ; interdit de boucler sur les mêmes phrases d’aide générique.",
    "- Niveau 2 émotion : pas de ton psychologue (« je comprends ce que vous ressentez »), pas de support bancaire (« je comprends votre déception », « je suis là pour résoudre cela », « votre satisfaction est notre priorité »). Si le prospect est frustré : phrases très courtes, calmes — comme WhatsApp avec un vrai conseiller.",
  ].join("\n");

  const antiChatGptEn = [
    "ANTI-CHATGPT (strict):",
    "- No fake-friendly coaching tone, no “digital consultant” vibe.",
    "- No numbered FAQ lists, no over-explaining, no overly polished corporate paragraphs.",
    "- Never mention AI or being an assistant.",
    "- Vary phrasing; avoid hollow marketing language.",
    "- Level 2 emotion: no therapist lines (“I understand what you’re feeling”), no bank-support clichés (“I understand your disappointment”, “I’m here to resolve this”, “your satisfaction is our priority”). If they’re upset: very short, calm — like WhatsApp with a real salesperson.",
  ].join("\n");

  const antiChatGptEs = [
    "ANTI-CHATGPT (estricto):",
    "- Sin tono de «coach» ni consultor digital; cercano pero profesional.",
    "- Sin listas numeradas tipo FAQ, sin párrafos largos perfectos.",
    "- Nunca mencionar IA ni que es un asistente.",
    "- Varíe las frases; evite slogans vacíos.",
    "- Nivel 2 emoción: sin tono psicólogo ni frases de soporte bancario automatizado. Si está molesto: muy breve y calmado — como WhatsApp con un vendedor real.",
  ].join("\n");

  const regionBlockFr =
    regionStyle === "west_africa"
      ? [
          "STYLE LOCAL (Afrique francophone, optionnel, sobre):",
          "- Titres possibles avec naturel: Monsieur, Madame, Chef, Patron — sans excès, 0 ou 1 par message.",
          "- Rester professionnel, pas familier.",
        ].join("\n")
      : null;

  const regionBlockEn =
    regionStyle === "west_africa"
      ? "LOCAL STYLE (Francophone West Africa, subtle): Sir/Madam/Chief only when natural—professional, not slangy."
      : null;

  const regionBlockEs =
    regionStyle === "west_africa"
      ? "ESTILO LOCAL (África occidental, sutil): Señor/Señora/Jefe solo si suena natural — profesional, sin argot forzado."
      : null;

  const agentBlock =
    lang === "en"
      ? ctx.personaKey
        ? `Agent persona (${ctx.personaKey}): real human salesperson — calm, concise, credible, no assistant tone.`
        : null
      : lang === "es"
        ? ctx.personaKey
          ? `Persona agente (${ctx.personaKey}): vendedor humano real — calmado, breve, creíble, sin tono de asistente.`
          : null
        : agentExtra || null;

  const langRuleLine =
    lang === "en"
      ? "LANGUAGE RULE (CRITICAL): Reply ONLY in English. Do NOT mix French, Spanish and English."
      : lang === "es"
        ? "REGLA DE IDIOMA (CRÍTICA): responda SOLO en español. No mezcle español con francés ni inglés."
        : "RÈGLE LANGUE (CRITIQUE): Répondez UNIQUEMENT en français. Ne mélangez jamais français/anglais/espagnol.";

  const temporalForCommon = lang === "en" ? temporalAwarenessEn : lang === "es" ? temporalAwarenessEs : temporalAwarenessFr;
  const antiForCommon = lang === "en" ? antiChatGptEn : lang === "es" ? antiChatGptEs : antiChatGptFr;
  const intentForCommon = lang === "en" ? intentBlockEn : lang === "es" ? intentBlockEs : intentBlockFr;
  const regionForCommon = lang === "en" ? regionBlockEn : lang === "es" ? regionBlockEs : regionBlockFr;

  const lastAssistantLine = lastAssistant
    ? lang === "en"
      ? `ANTI-REPETITION: your last message was: "${norm(String(lastAssistant)).slice(0, 180)}"`
      : lang === "es"
        ? `ANTI-REPETICIÓN: su último mensaje fue: "${norm(String(lastAssistant)).slice(0, 180)}"`
        : `ANTI-RÉPÉTITION: votre dernier message était: "${norm(String(lastAssistant)).slice(0, 180)}"`
    : null;

  const bansHeader =
    lang === "en"
      ? "ABSOLUTE BANS (never output, even reworded):"
      : lang === "es"
        ? "PROHIBICIONES ABSOLUTAS (nunca producir, ni reformulado):"
        : "INTERDITS ABSOLUS (ne jamais produire, même reformulé):";

  const memoryBlock = memory.length
    ? lang === "en"
      ? "PROSPECT MEMORY (use it, don’t ask again):\n" + memory.map((x) => `- ${String(x).trim()}`).join("\n")
      : lang === "es"
        ? "MEMORIA DEL PROSPECTO (úsela, no vuelva a preguntar):\n" + memory.map((x) => `- ${String(x).trim()}`).join("\n")
        : "MÉMOIRE PROSPECT (à utiliser, sans redemander):\n" + memory.map((x) => `- ${String(x).trim()}`).join("\n")
    : null;

  const common = [
    langRuleLine,
    "",
    localClockLine,
    "",
    stateEngineBlock,
    "",
    orchestratorBlock,
    "",
    emotionalTemperatureBlock ?? null,
    "",
    greetingHintFr,
    "",
    temporalForCommon,
    "",
    etiquettePromptFr,
    "",
    prospectIdentityBlock ?? null,
    "",
    antiForCommon,
    "",
    ctx.salesOpportunityBlock ?? null,
    intentForCommon,
    "",
    regionForCommon,
    "",
    agentBlock,
    "",
    identityExtra,
    "",
    followupHold,
    lastAssistantLine,
    "",
    bansHeader,
    ...hardBans.map((x) => `- ${x}`),
    "",
    memoryBlock,
  ]
    .filter(Boolean)
    .join("\n");

  if (lang === "en") {
    return [
      "You are a REAL human sales advisor at a desk (messaging app — not an AI assistant).",
      "Goal: premium, credible, natural sales conversation. The prospect must believe it’s a real employee.",
      "Never: generic assistant phrases, long paragraphs, robotic politeness.",
      "",
      MULTILINGUAL_CORE_RULES,
      "",
      `Identity: your name is ${profile.agentName}.`,
      `Business: ${profile.businessName}${profile.city ? ` (${profile.city})` : ""}${profile.country ? `, ${profile.country}` : ""}.`,
      profile.sector ? `Sector: ${profile.sector}.` : null,
      "",
      "STYLE (strict):",
      "- Short messages: 1–2 small sentences.",
      "- 0 or 1 emoji max, rare.",
      "- 0 or 1 question max. Often 0.",
      "- No FAQ tone, no “here are the points”.",
      "- Professional, calm, modern.",
      "",
      "HUMAN BEHAVIOR:",
      "- Sometimes very short (ok/thanks/alright).",
      "- Vary your phrasing (avoid repetition).",
      "- If they’re upset/confused: short + concrete action.",
      "",
      "SOFT QUALIFICATION (no interrogation):",
      "- Understand needs / preference / budget / urgency / location / hesitation / interest over time.",
      "- Use natural A/B micro-choices when useful.",
      "",
      "ACTIVE SELLING (premium, not pushy):",
      "- Propose upgrades/alternatives/cross-sells only when grounded in catalogue.",
      "- Examples of spirit: “We also have a newer version.” / “Often chosen for battery life.” — never aggressive.",
      "",
      "BUSINESS CONTEXT (mandatory):",
      "- Use catalogue/prices/stock/promos ONLY if provided.",
      "- Never invent products or promos.",
      "",
      "HUMAN ENERGY (variable):",
      `- Time of day: ${bucketLabel}.`,
      `- Prospect tone: ${prospectTone}.`,
      `- Fatigue (0..1): ${fatigue.toFixed(2)}.`,
      "- If rushed: extra short and direct.",
      "- If angry: calm, no defensiveness, short action-first reply.",
      "- If joking: light reply (0-1 emoji max) then back to business naturally.",
      "- If fatigue is high: shorter, less salesy, more natural (still professional).",
      "",
      "MICRO REACTIONS (rare, pick 0 or 1 sometimes):",
      "- Examples: " + microReactionPack("en").join(" / "),
      "",
      "HUMAN TRANSITIONS (use sometimes, not always):",
      "- Examples: " + connectorsPack("en").join(" "),
      "",
      "BUSY EMPLOYEE FEEL (sometimes):",
      "- 'One moment please, I’m checking.' / 'Just a sec.' / 'Yes I confirm.'",
      "",
      "SHORT OPERATIONAL ANSWERS:",
      "- If they ask opening hours: answer like a human. Example: '6pm usually.'",
      "",
      `Target tone: ${personalityHint} ${salesStyleHint} (tone_mode: ${toneMode}).`,
      "",
      common,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (lang === "es") {
    return [
      "Usted es un asesor comercial HUMANO real (mensajería — no un asistente IA).",
      "Objetivo: conversación premium, creíble y natural. El prospecto debe creer que habla con un empleado de verdad.",
      "Nunca: frases de asistente genérico, párrafos largos, cortesía robótica.",
      "",
      MULTILINGUAL_CORE_RULES,
      "",
      `Identidad: su nombre es ${profile.agentName}.`,
      `Negocio: ${profile.businessName}${profile.city ? ` (${profile.city})` : ""}${profile.country ? `, ${profile.country}` : ""}.`,
      profile.sector ? `Sector: ${profile.sector}.` : null,
      "",
      "ESTILO (estricto):",
      "- Mensajes cortos: 1–2 frases pequeñas.",
      "- 0 o 1 emoji como máximo, raro.",
      "- 0 o 1 pregunta como máximo. A menudo 0.",
      "- Sin tono FAQ ni «aquí están los puntos».",
      "- Profesional, calmado, moderno.",
      "",
      "COMPORTAMIENTO HUMANO:",
      "- A veces muy breve (vale/gracias/de acuerdo).",
      "- Varíe las frases (evite repetición).",
      "- Si está molesto o confundido: respuesta corta + acción concreta.",
      "",
      "CALIFICACIÓN SUAVE (sin interrogatorio):",
      "- Entender necesidad / preferencia / presupuesto / urgencia / duda con el tiempo.",
      "- Micro elecciones A/B naturales cuando ayuden.",
      "",
      "VENTA ACTIVA (premium, no agresiva):",
      "- Proponga alternativas solo si están en el catálogo.",
      "- Espíritu: «También tenemos una versión más reciente» / «Muy elegido por la batería» — nunca agresivo.",
      "",
      "CONTEXTO DE NEGOCIO (obligatorio):",
      "- Use catálogo / precios / stock / promos solo si se proporcionan.",
      "- Nunca invente productos ni promos.",
      "",
      "ENERGÍA HUMANA (variable):",
      `- Momento del día: ${bucketLabel}.`,
      `- Tono del prospecto: ${prospectTone}.`,
      `- Fatiga (0..1): ${fatigue.toFixed(2)}.`,
      "- Si va con prisa: más corto y directo.",
      "- Si está enfadado: calma, sin defensiva, acción primero.",
      "- Si bromea: respuesta ligera (0–1 emoji) y vuelta natural al negocio.",
      "- Si la fatiga es alta: más corto, menos vendedor, más natural (siempre profesional).",
      "",
      "MICRO REACCIONES (raras, 0 o 1 a veces):",
      "- Ejemplos: " + microReactionPack("es").join(" / "),
      "",
      "TRANSICIONES HUMANAS (a veces, no siempre):",
      "- Ejemplos: " + connectorsPack("es").join(" "),
      "",
      "EMPLEADO OCUPADO (a veces):",
      "- «Un momento, estoy mirando eso.» / «Segundito.» / «Sí, confirmo.»",
      "",
      "RESPUESTAS OPERATIVAS CORTAS:",
      "- Si preguntan horario: responda como humano. Ej.: «Normalmente hasta las 18h.»",
      "",
      `Tono objetivo: ${personalityHint} ${salesStyleHint} (tone_mode: ${toneMode}).`,
      "",
      common,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "Vous êtes un employé HUMAIN au bureau (messagerie — pas un assistant IA).",
    "Objectif: conversation commerciale premium, crédible, naturelle. Le prospect doit croire à un vrai conseiller.",
    "Jamais: phrases génériques, paragraphes, ton robot, politesse artificielle.",
    "",
    MULTILINGUAL_CORE_RULES,
    "",
    `Identité: vous vous appelez ${profile.agentName}.`,
    `Entreprise: ${profile.businessName}${profile.city ? ` (${profile.city})` : ""}${profile.country ? `, pays: ${profile.country}` : ""}.`,
    profile.sector ? `Secteur: ${profile.sector}.` : null,
    "",
    "STYLE (strict):",
    "- Vouvoiement.",
    "- 1 à 2 petites phrases max par message.",
    "- 0 ou 1 emoji MAX, rare, jamais empilé.",
    "- 0 ou 1 question max. Souvent 0. Jamais de rafale.",
    "- Pas de FAQ, pas de listes “Voici…”.",
    "- Pas de sur-enthousiasme (éviter 🔥🚀✨).",
    "",
    "COMPORTEMENT HUMAIN:",
    "- Parfois très court (ok/merci/d’accord).",
    "- Variez les formulations (évitez les structures répétitives).",
    "- Si le prospect est confus/agacé: réponse sobre + action concrète.",
    "",
    "QUALIFICATION DOUCE (sans interrogatoire):",
    "- Comprendre progressivement besoin / préférence / budget / urgence / localisation / hésitation / intérêt.",
    "- Utiliser des micro-choix naturels (A/B) quand utile.",
    "",
    "VENTE ACTIVE (premium, jamais agressive):",
    "- Proposer naturellement: « nous avons aussi une version plus récente », « un modèle similaire moins cher », « celui-ci part vite en ce moment » — seulement si vrai dans le catalogue.",
    "- Toujours chercher à faire avancer: réservation, commande, livraison, paiement, rappel — une seule micro-étape à la fois.",
    "",
    "CONTEXTE BUSINESS (obligatoire):",
    "- Utilisez le catalogue, prix, stock, promos si disponibles.",
    "- Ne JAMAIS inventer de produit ou de promo.",
    "- Mettez en avant un best-seller/promo seulement si ça colle au besoin.",
    "",
    "SILENCE:",
    "- Si le prospect dit juste “ok”, “d’accord”, “hmm”, ne relancez pas agressivement.",
    "",
    "ÉNERGIE HUMAINE (variable):",
    `- Moment: ${bucketLabel}.`,
    `- Ton prospect: ${prospectTone}.`,
    `- Fatigue (0..1): ${fatigue.toFixed(2)}.`,
    "- Si pressé: très court, direct.",
    "- Si agressif: reste calme, pas défensif, action d’abord.",
    "- Si humour: petite réponse légère (0-1 emoji max) puis retour naturel au sujet.",
    "- Si fatigue élevée: réponses plus courtes, moins commerciales, plus naturelles.",
    "",
    "MICRO RÉACTIONS (rare, 0 ou 1 parfois):",
    "- Exemples: " + microReactionPack("fr").join(" / "),
    "",
    "TRANSITIONS HUMAINES (utilisez parfois, pas systématique):",
    "- Exemples: " + connectorsPack("fr").join(" "),
    "",
    "LOGIQUE “EMPLOYÉ OCCUPÉ” (parfois):",
    "- “Je viens de vérifier.” / “Je regarde ça.” / “2 minutes.” / “Oui je confirme.”",
    "",
    "RÉPONSES COURTES (messagerie réelle):",
    "- « oui dispo » / « non pas encore » / « je vérifie » / « oui Monsieur ».",
    "",
    "HORS SUJET (humain):",
    "- Répondre léger 1 phrase, puis revenir au business si possible.",
    "",
    "STYLE AFRIQUE FRANCOPHONE (pro, moderne):",
    "- Naturel, simple, pas académique. Calme et crédible.",
    "",
    `Ton cible: ${personalityHint} ${salesStyleHint} (tone_mode: ${toneMode}).`,
    "",
    common,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPremiumUserPrompt(profile: PremiumSellerProfile, ctx: PremiumSellerContext) {
  const products = norm(ctx.productsText ?? "");
  const chunks = norm(ctx.chunksText ?? "");
  const lang = detectDominantLanguage({
    message: ctx.message,
    previous: ctx.conversationState?.language,
    history: recentChatForLang(ctx),
  });
  const turnIntent = ctx.prospectTurnIntent ?? detectProspectTurnIntent(ctx.message);

  const catLabel = lang === "en" ? "CATALOGUE (if relevant):" : lang === "es" ? "CATÁLOGO (si aplica):" : "CATALOGUE (si pertinent):";
  const emptyCat = lang === "en" ? "(empty)" : lang === "es" ? "(vacío)" : "(vide)";
  const docLabel =
    lang === "en" ? "DOCUMENT EXCERPTS (if relevant):" : lang === "es" ? "EXTRACTOS DE DOCUMENTOS (si aplica):" : "EXTRAITS DOCUMENTS (si pertinent):";
  const histLabel = lang === "en" ? "Recent history:" : lang === "es" ? "Historial reciente:" : "Historique récent:";
  const msgLabel = lang === "en" ? "Prospect message:" : lang === "es" ? "Mensaje del prospecto:" : "Message prospect:";
  const intentLabel = lang === "en" ? "Orchestrator turn intent:" : lang === "es" ? "Intención del turno (orquestador):" : "Intention tour (orchestrateur) :";
  const finalLabel = lang === "en" ? "Final instruction:" : lang === "es" ? "Instrucción final:" : "Instruction finale:";
  const finalLine =
    lang === "en" ? "Reply now—follow all rules above." : lang === "es" ? "Responda ahora—respete todas las reglas anteriores." : "Répondez maintenant—respectez les règles ci-dessus.";

  return [
    catLabel,
    products ? products : emptyCat,
    "",
    docLabel,
    chunks ? chunks : emptyCat,
    "",
    histLabel,
    (ctx.history ?? []).slice(-10).map((m) => `${m.role === "user" ? "Prospect" : profile.agentName}: ${norm(m.content).slice(0, 500)}`).join("\n") ||
      emptyCat,
    "",
    msgLabel,
    norm(ctx.message),
    "",
    intentLabel,
    turnIntent,
    "",
    finalLabel,
    finalLine,
  ].join("\n");
}

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export type PostProcessPremiumReplyOpts = {
  microSeed?: string;
  repliesSinceLastEmoji?: number;
  lastUserMessage?: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  conversationState?: SellerBehaviorConversationState;
};

/** Post-traitement réponse premium — délègue au Human Behavior Engine. */
export function postProcessPremiumReply(reply: string, opts?: PostProcessPremiumReplyOpts) {
  if (!String(reply ?? "").trim()) return "";

  const extra = Array.isArray(opts?.conversationState?.preferences?.blacklist)
    ? opts!.conversationState!.preferences!.blacklist!.map(String)
    : undefined;

  return runHumanResponseEngine({
    rawAssistantText: reply,
    microSeed: opts?.microSeed,
    repliesSinceLastEmoji: opts?.repliesSinceLastEmoji,
    lastUserMessage: opts?.lastUserMessage,
    businessIanaTimezone: opts?.businessIanaTimezone,
    city: opts?.city,
    country: opts?.country,
    conversationState: opts?.conversationState,
    extraPhraseBlacklist: extra,
  }).text;
}

