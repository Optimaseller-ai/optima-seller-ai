import "server-only";

import { DateTime } from "luxon";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { agentBehaviorPromptFr } from "@/lib/agents/personality/persona-prompts";
import { formatBusinessLocalDateTime } from "@/lib/agents/timing/business-timezone";
import {
  detectProspectExplicitFrenchGreeting,
  englishSalutationForLocalTime,
  formatProspectProfilePromptBlock,
  englishHonorificSmart,
  frenchHonorificSmart,
  frenchSalutationForLocalTime,
  greetingSlotFromLocalHour,
  resolveFrenchOpeningPhrase,
} from "@/lib/agents/memory/prospect-profile";
import { ANTI_AI_PHRASE_BLACKLIST } from "@/lib/agents/human-behavior/anti-ai/phrase-blacklist";
import { runHumanResponseEngine } from "@/lib/agents/human-behavior/human-response-engine";

type Role = "user" | "assistant";

export type SellerLanguage = "fr" | "en";

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
  /** Bloc injecté par `runSalesOpportunityEngine` (vente active) */
  salesOpportunityBlock?: string;
};

function norm(s: string) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectDominantLanguage(args: { message: string; previous?: SellerLanguage }): SellerLanguage {
  const msg = norm(args.message).toLowerCase();
  if (!msg) return args.previous ?? "fr";

  // Strong cues
  if (/\b(hello|hi|hey|good morning|good evening|good afternoon|how much|how much is|price|available|in stock|delivery|pay|payment)\b/i.test(msg)) {
    return "en";
  }
  if (/\b(bonjour|bonsoir|bonne\s+après|bonne\s+apres|bon\s+matin|svp|s'il vous plaît|s il vous plait|combien|prix|disponible|en stock|livraison|payer|paiement)\b/i.test(msg)) {
    return "fr";
  }

  const enWords = msg.match(
    /\b(the|a|an|and|or|but|with|for|to|from|of|in|on|at|is|are|we|you|your|sir|madam|please|thanks|thank)\b/gi,
  )?.length ?? 0;
  const frWords = msg.match(
    /\b(le|la|les|un|une|des|et|ou|mais|avec|pour|de|du|dans|sur|chez|est|sont|nous|vous|votre|monsieur|madame|s'il|merci)\b/gi,
  )?.length ?? 0;

  // Mixed: choose dominant, otherwise keep previous.
  if (enWords === frWords) return args.previous ?? "fr";
  return enWords > frWords ? "en" : "fr";
}

function isBareAck(msg: string) {
  const m = norm(msg).toLowerCase();
  return /^(ok|okay|k|d['’]accord|dac|bien|parfait|merci|mercii|cool|hmm+|mm+|thanks|thank you|thx|👍|👌|🙏)$/i.test(m);
}

function isGreeting(msg: string) {
  const m = norm(msg)
    .toLowerCase()
    .replace(/[.!?…]+$/g, "")
    .trim();
  return (
    /^(bonjour|bonsoir|bjr|bsr|salut|cc|coucou|hello|hi|hey|good morning|good evening|good afternoon)\b/i.test(m) ||
    /^(bonne\s+après[\s-]?midi|bonne\s+apres[\s-]?midi|bon\s+matin)\b/i.test(m)
  );
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

  const angry = /(nul|arnaque|scam|mensonge|marre|😠|😡|🤬|je suis pas content|pas content|c'est quoi ça|c est quoi ca)/i.test(text);
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
  if (/(vous mangez|tu manges|on mange|quoi ce soir|ce soir tu manges|you eating|what are you eating|dinner|what’s for dinner)/i.test(m))
    return "food";
  if (/(ça va|ca va|how are you|you good|you ok)/i.test(m)) return "smalltalk";
  return null;
}

function microReactionPack(lang: SellerLanguage) {
  return lang === "en"
    ? ["Right.", "Okay.", "I see.", "Alright.", "Sure.", "Just a sec, I’m checking."]
    : ["Ah oui.", "Je vois.", "D’accord.", "Effectivement.", "Oui possible.", "Attendez je regarde."];
}

function connectorsPack(lang: SellerLanguage) {
  return lang === "en"
    ? ["So,", "In that case,", "But", "Honestly,", "Alright then,"]
    : ["Alors,", "Dans ce cas,", "Par contre,", "Honnêtement,", "Du coup,"];
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
  const fr = ["Je regarde cela.", "Un instant s'il vous plaît.", "Je vérifie."];
  const en = ["Just a moment.", "Let me check that.", "One moment please."];
  return pickOne(lang === "en" ? en : fr, seed);
}

export function quickHumanReply(profile: PremiumSellerProfile, ctx: PremiumSellerContext): string | null {
  const message = norm(ctx.message);
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  const hasAssistantBefore = history.some((m) => m.role === "assistant");
  const lang = detectDominantLanguage({ message, previous: ctx.conversationState?.language });

  if (isGreeting(message)) {
    const nowLocal = businessNow(profile);
    const salFr = frenchSalutationForLocalTime(nowLocal);
    const salEn = englishSalutationForLocalTime(nowLocal);
    const explicitFr = lang === "fr" ? detectProspectExplicitFrenchGreeting(message) : null;
    const resolvedFr = explicitFr ? resolveFrenchOpeningPhrase({ nowLocal, explicitKind: explicitFr }) : null;
    const dayPartFr = resolvedFr?.phraseFr ?? salFr.phraseFr;
    const pp = ctx.conversationState?.prospectProfile;
    const honorFr = frenchHonorificSmart(pp);
    const dayPartEn = salEn.phraseEn;

    const honorEn = englishHonorificSmart(pp);

    // Only do full intro if it’s the start (no assistant messages yet).
    if (!hasAssistantBefore) {
      const sector = String(profile.sector ?? "").toLowerCase();
      let orientFr = "Nous avons actuellement plusieurs modèles disponibles selon votre budget.";
      let orientEn = "We currently have several models available depending on your budget.";
      if (/chauss|sport|textil|mode|vetement|vêtement/i.test(sector)) {
        orientFr = "Vous cherchez plutôt chaussures, accessoires ou autre chose dans ce rayon ?";
        orientEn = "Are you mainly looking for shoes, accessories, or something else in that range?";
      } else if (/élect|electron|info|tel|tech|informat|phone|mobile/i.test(sector)) {
        orientFr = "Vous cherchez plutôt téléphones, accessoires ou matériel électronique ?";
        orientEn = "Are you looking for phones, accessories, or other electronics?";
      }

      const frLine =
        honorFr != null
          ? ([
              `${dayPartFr} ${honorFr}.\nJe vous écoute.`,
              `${dayPartFr} ${honorFr}.\n${orientFr}`,
              `${dayPartFr} ${honorFr}.\n${profile.businessName} — ${orientFr}`,
            ] as const)
          : ([
              `${dayPartFr}.\nJe vous écoute — ${orientFr}`,
              `${dayPartFr}.\n${profile.businessName} — ${orientFr}`,
              `${dayPartFr}.\n${orientFr}`,
              `Bonjour et bienvenue chez ${profile.businessName}.\n${orientFr}`,
            ] as const);

      const enLine =
        honorEn != null
          ? ([
              `${dayPartEn} ${honorEn}.\nI'm listening — ${orientEn}`,
              `${dayPartEn} ${honorEn}.\n${orientEn}`,
              `${dayPartEn} ${honorEn}.\n${profile.businessName} — ${orientEn}`,
            ] as const)
          : ([
              `${dayPartEn}.\nI'm listening — ${orientEn}`,
              `${dayPartEn}.\n${profile.businessName} — ${orientEn}`,
              `${dayPartEn}.\n${orientEn}`,
              `Hello and welcome to ${profile.businessName}.\n${orientEn}`,
            ] as const);

      const variants = lang === "en" ? [...enLine] : [...frLine];
      return pickOne(variants, message + profile.agentName + profile.businessName);
    }

    const short =
      lang === "en"
        ? honorEn != null
          ? [`${dayPartEn} ${honorEn}.`, `${dayPartEn}.`, "Noted."]
          : [`${dayPartEn}.`, "Noted.", "Got it."]
        : honorFr != null
          ? [`${dayPartFr} ${honorFr}.`, `${dayPartFr}.`, "Bien reçu."]
          : [`${dayPartFr}.`, "Bien reçu.", "C’est noté."];
    return pickOne(short, message + profile.agentName);
  }

  if (isBareAck(message)) {
    const pp = ctx.conversationState?.prospectProfile;
    const hFr = frenchHonorificSmart(pp);
    const variants =
      lang === "en"
        ? ["Alright.", "Perfect.", "Noted.", "Okay."]
        : hFr
          ? [`D’accord ${hFr}.`, "Très bien.", "Parfait.", "Bien reçu."]
          : ["D’accord.", "Très bien.", "Parfait.", "Bien reçu."];
    return pickOne(variants, message + (profile.agentName ?? ""));
  }

  if (isWhoAreYou(message)) {
    return lang === "en"
      ? `I’m ${profile.agentName} from ${profile.businessName}.`
      : `Je suis ${profile.agentName} du service client ${profile.businessName}.`;
  }

  if (isWhoDoYouWorkFor(message)) {
    return lang === "en" ? `I work with the ${profile.businessName} team.` : `Je travaille avec l’équipe ${profile.businessName}.`;
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
    if (hour >= 22 || hour < 5) return `Ici il est ${wall} — un peu tard.`;
    if (hour >= 18) return `Ici il est ${wall} — on est le soir.`;
    return `Ici il est ${wall} — journée encore.`;
  }

  const offTopic = detectOffTopic(message);
  if (offTopic === "food") {
    const variants =
      lang === "en"
        ? ["Haven’t thought about it yet.", "Good question.", "Not sure yet."]
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
  const lang = detectDominantLanguage({ message: ctx.message, previous: ctx.conversationState?.language });
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
      : `HEURE LOCALE BOUTIQUE (${profile.city ?? "—"}, ${profile.country ?? "—"} — fuseau ${iana}) : ${localFmt.wallClock}.`
    : null;

  const prospectIdentityBlock = formatProspectProfilePromptBlock(prospectIdentity, lang);

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
    "- Pour avancer sans robot : « Je vous écoute », « Quel modèle vous intéresse ? », « Une fourchette de budget ? » — alternez ; interdit de boucler sur les mêmes phrases d’aide générique.",
  ].join("\n");

  const antiChatGptEn = [
    "ANTI-CHATGPT (strict):",
    "- No fake-friendly coaching tone, no “digital consultant” vibe.",
    "- No numbered FAQ lists, no over-explaining, no overly polished corporate paragraphs.",
    "- Never mention AI or being an assistant.",
    "- Vary phrasing; avoid hollow marketing language.",
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

  const agentBlock =
    lang === "en"
      ? ctx.personaKey
        ? `Agent persona (${ctx.personaKey}): real human salesperson — calm, concise, credible, no assistant tone.`
        : null
      : agentExtra || null;

  const common = [
    lang === "en"
      ? "LANGUAGE RULE (CRITICAL): Reply ONLY in English. Do NOT mix French and English."
      : "RÈGLE LANGUE (CRITIQUE): Répondez UNIQUEMENT en français. Ne mélangez jamais français/anglais.",
    "",
    localClockLine,
    "",
    greetingHintFr,
    "",
    lang === "en" ? temporalAwarenessEn : temporalAwarenessFr,
    "",
    etiquettePromptFr,
    "",
    prospectIdentityBlock ?? null,
    "",
    lang === "en" ? antiChatGptEn : antiChatGptFr,
    "",
    ctx.salesOpportunityBlock ?? null,
    lang === "en" ? intentBlockEn : intentBlockFr,
    "",
    lang === "en" ? regionBlockEn : regionBlockFr,
    "",
    agentBlock,
    "",
    identityExtra,
    "",
    followupHold,
    lastAssistant
      ? lang === "en"
        ? `ANTI-REPETITION: your last message was: "${norm(String(lastAssistant)).slice(0, 180)}"`
        : `ANTI-RÉPÉTITION: votre dernier message était: "${norm(String(lastAssistant)).slice(0, 180)}"`
      : null,
    "",
    lang === "en"
      ? "ABSOLUTE BANS (never output, even reworded):"
      : "INTERDITS ABSOLUS (ne jamais produire, même reformulé):",
    ...hardBans.map((x) => `- ${x}`),
    "",
    memory.length
      ? lang === "en"
        ? "PROSPECT MEMORY (use it, don’t ask again):\n" + memory.map((x) => `- ${String(x).trim()}`).join("\n")
        : "MÉMOIRE PROSPECT (à utiliser, sans redemander):\n" + memory.map((x) => `- ${String(x).trim()}`).join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (lang === "en") {
    return [
      "You are a REAL human sales advisor at a desk (messaging app — not an AI assistant).",
      "Goal: premium, credible, natural sales conversation. The prospect must believe it’s a real employee.",
      "Never: generic assistant phrases, long paragraphs, robotic politeness.",
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

  return [
    "Vous êtes un employé HUMAIN au bureau (messagerie — pas un assistant IA).",
    "Objectif: conversation commerciale premium, crédible, naturelle. Le prospect doit croire à un vrai conseiller.",
    "Jamais: phrases génériques, paragraphes, ton robot, politesse artificielle.",
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
  const lang = detectDominantLanguage({ message: ctx.message, previous: ctx.conversationState?.language });

  return [
    lang === "en" ? "CATALOGUE (if relevant):" : "CATALOGUE (si pertinent):",
    products ? products : lang === "en" ? "(empty)" : "(vide)",
    "",
    lang === "en" ? "DOCUMENT EXCERPTS (if relevant):" : "EXTRAITS DOCUMENTS (si pertinent):",
    chunks ? chunks : lang === "en" ? "(empty)" : "(vide)",
    "",
    lang === "en" ? "Recent history:" : "Historique récent:",
    (ctx.history ?? []).slice(-12).map((m) => `${m.role === "user" ? "Prospect" : profile.agentName}: ${norm(m.content).slice(0, 500)}`).join("\n") ||
      (lang === "en" ? "(empty)" : "(vide)"),
    "",
    lang === "en" ? "Prospect message:" : "Message prospect:",
    norm(ctx.message),
    "",
    lang === "en" ? "Final instruction:" : "Instruction finale:",
    lang === "en" ? "Reply now—follow all rules above." : "Répondez maintenant—respectez les règles ci-dessus.",
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

