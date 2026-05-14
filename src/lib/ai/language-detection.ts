/**
 * Détection automatique de la langue du prospect (FR / EN / ES).
 * Utilisable côté client et serveur (pas de server-only).
 */

export type ConversationLanguage = "fr" | "en" | "es";

function norm(s: string) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * Score heuristique par langue sur le texte (message + derniers messages user).
 */
export function scoreLanguages(blob: string): { fr: number; en: number; es: number } {
  const t = norm(blob);
  if (!t) return { fr: 0, en: 0, es: 0 };

  let fr = 0;
  let en = 0;
  let es = 0;

  if (/\b(bonjour|bonsoir|salut|coucou|bonne\s+après|monsieur|madame|merci\s+beaucoup|s'il\s+vous|svp|combien|prix|livraison|disponible|acheter|commande|fcfa|cfa|vous\s+avez)\b/i.test(t)) fr += 4;
  if (/\b(hello|hi\b|hey|good\s+morning|good\s+evening|good\s+afternoon|sir|madam|please|thanks|thank\s+you|price|available|delivery|stock|how\s+much|do\s+you\s+have|order)\b/i.test(t)) en += 4;
  if (/\b(hola|buenos\s+días|buenas\s+tardes|buenas\s+noches|gracias|por\s+favor|señor|señora|precio|disponible|envío|cuánto|tienen|tiene|comprar|pedido|zapatillas|modelo|¿tienen)\b/i.test(t)) es += 4;

  if (/[¿¡]/.test(blob)) es += 2;

  fr += countMatches(t, /\b(le|la|les|un|une|des|vous|votre|notre|avec|pour|chez|est|sont|très|aussi|bien)\b/g);
  en += countMatches(t, /\b(the|and|with|this|that|your|our|have|has|also|well|when|what|where|can|could|would)\b/g);
  es += countMatches(t, /\b(el|la|los|las|usted|ustedes|con|para|por|muy|bien|también|cuando|que|hay|está|están)\b/g);

  if (/\b(comment\s+allez|comment\s+tu\s+vas|ça\s+va)\b/i.test(t)) fr += 3;
  if (/\b(how\s+are\s+you|are\s+you\s+ok)\b/i.test(t)) en += 3;
  if (/\b(cómo\s+está|cómo\s+estás|qué\s+tal)\b/i.test(t)) es += 3;

  return { fr, en, es };
}

/**
 * Détecte la langue du tour courant : message + derniers messages user + mémoire `previous` (sticky si signal faible).
 * Langue inconnue / scores nuls → **anglais** (fallback international).
 */
export function detectConversationLanguage(args: {
  message: string;
  previous?: ConversationLanguage;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): ConversationLanguage {
  const userSnippets = (args.history ?? [])
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.content);
  const blob = [...userSnippets, args.message].join(" \n ");

  const scores = scoreLanguages(blob);
  const ranked = (["fr", "en", "es"] as const)
    .map((k) => ({ k, s: k === "fr" ? scores.fr : k === "en" ? scores.en : scores.es }))
    .sort((a, b) => b.s - a.s);

  const top = ranked[0]!;
  const second = ranked[1] ?? { k: "en" as const, s: 0 };
  const prev = args.previous;

  if (top.s === 0) return prev ?? "en";

  if (prev) {
    if (top.s < 3) return prev;
    if (top.s === second.s) return prev;
    if (top.s - second.s < 2 && top.k !== prev) {
      const msgScores = scoreLanguages(args.message);
      const msgRanked = (["fr", "en", "es"] as const)
        .map((k) => ({ k, s: k === "fr" ? msgScores.fr : k === "en" ? msgScores.en : msgScores.es }))
        .sort((a, b) => b.s - a.s);
      if (msgRanked[0]!.s < 5) return prev;
    }
  }

  return top.k;
}
