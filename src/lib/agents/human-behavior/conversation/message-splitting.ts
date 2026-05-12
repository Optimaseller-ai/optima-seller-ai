import "server-only";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Découpe en phrases fines (., …, !, ?). */
function splitSentences(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

/**
 * Découpe parfois un long texte en plusieurs bulles courtes (style employé).
 * Déterministe via `seed`. Sinon un seul segment = texte entier.
 */
export function maybeSplitAssistantMessage(text: string, seed: string): string[] {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length < 160) return [raw];

  const oneLine = raw.replace(/\n+/g, " ").trim();
  const sentences = splitSentences(oneLine);
  if (sentences.length < 2) return [raw];

  const roll = seedHash(seed + raw) % 100;
  if (roll >= 20) return [raw];

  if (sentences.length === 2) {
    return [sentences[0]!, sentences[1]!];
  }

  const first = sentences[0]!;
  const last = sentences[sentences.length - 1]!;
  const middle = sentences.slice(1, -1).join(" ").trim();

  if (middle.length >= 24) {
    return [first, middle, last].filter((x) => x.length > 0).slice(0, 3);
  }
  return [first, sentences.slice(1).join(" ").trim()].filter((x) => x.length > 0);
}
