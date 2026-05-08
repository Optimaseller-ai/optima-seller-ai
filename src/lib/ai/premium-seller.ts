import "server-only";

type Role = "user" | "assistant";

export type SellerLanguage = "fr" | "en";

export type PremiumSellerProfile = {
  agentName: string;
  businessName: string;
  sector?: string;
  city?: string;
  agentPersonality?: "chaleureux" | "professionnel" | "dynamique";
  salesStyle?: "conseiller" | "closer" | "premium";
};

export type PremiumSellerContext = {
  message: string;
  history: Array<{ role: Role; content: string }>;
  conversationState?: {
    language?: SellerLanguage;
    preferences?: { blacklist?: string[] };
    mood?: string;
    memory?: string[];
    tone_mode?: "chill" | "premium" | "vendeur_soft" | "support_client" | "conversation_naturelle";
    stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  };
  productsText?: string; // already formatted list
  chunksText?: string; // already formatted excerpts
};

const ABSOLUTE_BANS = [
  "Comment puis-je vous aider",
  "Je suis là pour vous aider",
  "Je peux vous aider",
  "Je peux vous assister",
  "N'hésitez pas",
  "N’hésitez pas",
  "Pas de souci",
  "Je comprends",
  "Je suis désolé",
  "Je suis désolée",
  "Désolé",
  "Avez-vous besoin d'autre chose",
  "Avez-vous besoin d’autre chose",
  "Je reste disponible",
  "Je reste à votre disposition",
  "Je vais faire de mon mieux",
  "Tu cherches des infos",
  "Tu cherches des informations",
  "Assistant IA",
  "chatbot",
  // EN generic assistant phrases
  "How may I assist you",
  "How can I help you",
  "I'm here to help",
  "I am here to help",
  "Feel free to",
  "No worries",
];

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
  if (/\b(bonjour|bonsoir|svp|s'il vous plaît|s il vous plait|combien|prix|disponible|en stock|livraison|payer|paiement)\b/i.test(msg)) {
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
  const m = norm(msg).toLowerCase();
  return /^(bonjour|bonsoir|bjr|bsr|salut|cc|coucou|hello|hi|hey|good morning|good evening|good afternoon)\b/i.test(m);
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

function hourBucket(h: number) {
  if (h >= 6 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "afternoon";
  if (h >= 18 && h <= 22) return "evening";
  return "night";
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

export function quickHumanReply(profile: PremiumSellerProfile, ctx: PremiumSellerContext): string | null {
  const message = norm(ctx.message);
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  const hasAssistantBefore = history.some((m) => m.role === "assistant");
  const lang = detectDominantLanguage({ message, previous: ctx.conversationState?.language });

  if (isGreeting(message)) {
    const hour = new Date().getHours();
    const dayPartFr = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
    const dayPartEn = hour >= 18 || hour < 5 ? "Good evening" : "Hello";

    // Only do full intro if it’s the start (no assistant messages yet).
    if (!hasAssistantBefore) {
      const variants =
        lang === "en"
          ? [
              `${dayPartEn}.\nYou’re welcome to ${profile.businessName}. I’m ${profile.agentName}.`,
              `${dayPartEn} sir.\nThis is ${profile.agentName} from ${profile.businessName}.`,
              `${dayPartEn} madam.\nThanks for reaching out to ${profile.businessName}.`,
              `${dayPartEn}.\n${profile.agentName} here (${profile.businessName}).`,
            ]
          : [
              `${dayPartFr} et bienvenue chez ${profile.businessName}.\nJe suis ${profile.agentName} du service client.`,
              `${dayPartFr} Monsieur.\nJe suis ${profile.agentName}, service commercial ${profile.businessName}.`,
              `${dayPartFr} Madame.\nMerci de nous avoir contactés, ${profile.businessName}.`,
              `${dayPartFr}.\n${profile.agentName} à l’appareil (${profile.businessName}).`,
            ];
      return pickOne(variants, message + profile.agentName + profile.businessName);
    }

    const short =
      lang === "en"
        ? [`${dayPartEn} sir.`, `${dayPartEn} madam.`, `${dayPartEn}.`, "Noted."]
        : [`${dayPartFr} Monsieur.`, `${dayPartFr} Madame.`, `${dayPartFr}.`, "Bien reçu."];
    return pickOne(short, message + profile.agentName);
  }

  if (isBareAck(message)) {
    const variants = lang === "en" ? ["Alright sir.", "Perfect.", "Noted.", "Okay."] : ["D’accord Monsieur.", "Très bien.", "Parfait.", "Bien reçu."];
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
    const hour = new Date().getHours();
    if (lang === "en") {
      if (hour >= 22 || hour < 5) return "It’s pretty late now.";
      if (hour >= 18) return "We’re getting into the evening.";
      return "Still daytime for now.";
    }
    if (hour >= 22 || hour < 5) return "Il est un peu tard là.";
    if (hour >= 18) return "On approche de la soirée.";
    return "On est encore dans la journée.";
  }

  const offTopic = detectOffTopic(message);
  if (offTopic === "food") {
    const variants =
      lang === "en"
        ? ["Honestly I haven’t even thought about it yet 😄", "Good question 😄", "Not sure yet 😄"]
        : ["Je n’ai même pas encore réfléchi 😄", "Bonne question 😄", "Je ne sais pas encore 😄"];
    return pickOne(variants, message + profile.agentName);
  }

  return null;
}

export function buildPremiumSystemPrompt(profile: PremiumSellerProfile, ctx: PremiumSellerContext) {
  const toneMode = ctx.conversationState?.tone_mode ?? "conversation_naturelle";
  const blacklist = Array.isArray(ctx.conversationState?.preferences?.blacklist) ? ctx.conversationState!.preferences!.blacklist!.slice(0, 30) : [];
  const memory = Array.isArray(ctx.conversationState?.memory) ? ctx.conversationState!.memory!.slice(0, 20) : [];
  const lang = detectDominantLanguage({ message: ctx.message, previous: ctx.conversationState?.language });
  const fatigue = Math.max(0, Math.min(1, ctx.conversationState?.stats?.fatigue ?? 0));
  const hour = new Date().getHours();
  const bucket = hourBucket(hour);
  const prospectTone = detectProspectTone(ctx.message, ctx.history ?? []);

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

  const hardBans = [...ABSOLUTE_BANS, ...blacklist].filter(Boolean);

  const common = [
    lang === "en"
      ? "LANGUAGE RULE (CRITICAL): Reply ONLY in English. Do NOT mix French and English."
      : "RÈGLE LANGUE (CRITIQUE): Répondez UNIQUEMENT en français. Ne mélangez jamais français/anglais.",
    "",
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
        ? "PROSPECT MEMORY (use it, don’t ask again):\n" + memory.map((x) => `- ${x}`).join("\n")
        : "MÉMOIRE PROSPECT (à utiliser, sans redemander):\n" + memory.map((x) => `- ${x}`).join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (lang === "en") {
    return [
      "You are a REAL human employee on WhatsApp (not an AI assistant).",
      "Goal: premium, credible, natural sales conversation. The prospect must forget it’s AI.",
      "Never: generic assistant phrases, long paragraphs, robotic politeness.",
      "",
      `Identity: your name is ${profile.agentName}.`,
      `Business: ${profile.businessName}${profile.city ? ` (${profile.city})` : ""}.`,
      profile.sector ? `Sector: ${profile.sector}.` : null,
      "",
      "STYLE (strict):",
      "- Short WhatsApp messages: 1–2 small sentences.",
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
      "BUSINESS CONTEXT (mandatory):",
      "- Use catalogue/prices/stock/promos ONLY if provided.",
      "- Never invent products or promos.",
      "",
      "HUMAN ENERGY (variable):",
      `- Time of day: ${bucket}.`,
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
    "Vous êtes un employé HUMAIN au WhatsApp (pas un assistant IA).",
    "Objectif: conversation commerciale premium, crédible, naturelle. Le prospect doit oublier l’IA.",
    "Jamais: phrases génériques, paragraphes, ton robot, politesse artificielle.",
    "",
    `Identité: vous vous appelez ${profile.agentName}.`,
    `Entreprise: ${profile.businessName}${profile.city ? ` (${profile.city})` : ""}.`,
    profile.sector ? `Secteur: ${profile.sector}.` : null,
    "",
    "STYLE (strict):",
    "- Vouvoiement.",
    "- 1 à 2 petites phrases max par message (WhatsApp).",
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
    "CONTEXTE BUSINESS (obligatoire):",
    "- Utilisez le catalogue, prix, stock, promos si disponibles.",
    "- Ne JAMAIS inventer de produit ou de promo.",
    "- Mettez en avant un best-seller/promo seulement si ça colle au besoin.",
    "",
    "SILENCE:",
    "- Si le prospect dit juste “ok”, “d’accord”, “hmm”, ne relancez pas agressivement.",
    "",
    "ÉNERGIE HUMAINE (variable):",
    `- Moment: ${bucket}.`,
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
    "RÉPONSES COURTES (WhatsApp réel):",
    "- “oui dispo” / “non pas encore” / “je vérifie” / “oui Monsieur”.",
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
    (ctx.history ?? []).slice(-5).map((m) => `${m.role === "user" ? "Prospect" : profile.agentName}: ${norm(m.content).slice(0, 500)}`).join("\n") ||
      (lang === "en" ? "(empty)" : "(vide)"),
    "",
    lang === "en" ? "Prospect message:" : "Message prospect:",
    norm(ctx.message),
    "",
    lang === "en" ? "Final instruction:" : "Instruction finale:",
    lang === "en"
      ? "Reply like a real premium WhatsApp sales rep. Short. Natural. Business. 0–1 question max. English only."
      : "Répondez comme un vendeur WhatsApp humain et premium. Court. Naturel. Business. 0-1 question max. Français uniquement.",
  ].join("\n");
}

export function postProcessPremiumReply(reply: string) {
  let out = String(reply ?? "").trim();
  if (!out) return out;

  // Hard remove banned phrases if they leak in.
  for (const phrase of ABSOLUTE_BANS) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "").trim();
  }

  // Remove excessive emojis (keep at most 1 total).
  const emojis = out.match(/[\p{Extended_Pictographic}]/gu) ?? [];
  if (emojis.length > 1) {
    let kept = 0;
    out = out.replace(/[\p{Extended_Pictographic}]/gu, (m) => {
      kept += 1;
      return kept === 1 ? m : "";
    });
    out = out.replace(/\s{2,}/g, " ").trim();
  }

  // Enforce shortness (avoid paragraphs).
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  out = lines.slice(0, 3).join("\n");
  if (out.length > 420) out = out.slice(0, 420).trim();

  // Avoid trailing generic closings.
  out = out.replace(/\b(à bientôt|bonne journée|bonne soirée)\b\.?$/i, "").trim();
  // Avoid overly formal "policy language" that feels robotic.
  out = out
    .replace(/\b(officiellement|veuillez|nous\s+vous\s+informons|conformément)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return out;
}

