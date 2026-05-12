import "server-only";

/**
 * États émotionnels prospect pour adapter ton, longueur et délais.
 * (Distinct du ton « vendeur » dans seller-prompts.)
 */
export type ProspectEmotion =
  | "frustration"
  | "anger"
  | "hesitation"
  | "curiosity"
  | "impatience"
  | "enthusiasm"
  | "neutral";

const FRUSTRATION = /(marre|ras\s*le\s*bol|nul|arnaque|scam|mensonge|honte|inadmissible|inacceptable|réclamation|réclamer|plainte|déçu|décue|déçus|pas\s+content|furious|angry|upset)/i;
const ANGER = /(connard|conne|merde|putain|fdp|crève|tue|😠|😡|🤬)/i;
const HESITATION = /(hésit|peut-être|pas\s+sûr|pas\s+sure|je\s+sais\s+pas|sais\s+pas|doute|réfléch|euh+|hmm+|🤔|😕)/i;
const CURIOSITY = /(c['’]est\s+quoi|explique|pourquoi|comment\s+ça|intéressant|curieux|curieuse|what\s+is|how\s+does)/i;
const IMPATIENCE = /(\b(vite|urgent|asap|maintenant|tout\s+de\s+suite|déjà|depuis|attends|attendez)\b|!!+|⏱|⌛)/i;
const ENTHUSIASM = /(super|génial|géniale|top|parfait|excellent|hâte|impatient|impatiente|yes|yeah|🔥|🎉|😍)/i;

/**
 * Détection heuristique rapide (sans modèle). Dernières correspondances prioritaires.
 */
export function detectProspectEmotion(message: string): ProspectEmotion {
  const msg = String(message ?? "").trim();
  if (!msg) return "neutral";

  if (ANGER.test(msg)) return "anger";
  if (FRUSTRATION.test(msg)) return "frustration";
  if (IMPATIENCE.test(msg)) return "impatience";
  if (HESITATION.test(msg)) return "hesitation";
  if (CURIOSITY.test(msg)) return "curiosity";
  if (ENTHUSIASM.test(msg)) return "enthusiasm";

  return "neutral";
}

/** Multiplicateur de délai « humain » (1 = normal). */
export function emotionDelayFactor(emotion: ProspectEmotion): number {
  switch (emotion) {
    case "anger":
    case "frustration":
      return 0.85;
    case "impatience":
      return 0.75;
    case "hesitation":
      return 1.15;
    case "curiosity":
      return 1.05;
    case "enthusiasm":
      return 1.0;
    default:
      return 1.0;
  }
}
