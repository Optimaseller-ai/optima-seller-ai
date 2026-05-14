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

function collapseChunks(chunks: string[], maxChunks: 1 | 2): string[] {
  const m = Math.max(1, Math.min(2, maxChunks));
  if (chunks.length <= m) return chunks;
  if (m === 1) return [chunks.join(" ").replace(/\s+/g, " ").trim()];
  return chunks.slice(0, 2);
}

/**
 * Découpe parfois un long texte en plusieurs bulles courtes (style employé).
 * `maxChunks` : jamais plus de 2 bulles (évite l’effet « plusieurs mini-IA »).
 */
export function maybeSplitAssistantMessage(text: string, seed: string, maxChunks: 1 | 2 = 2): string[] {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length < 160) return [raw];

  const oneLine = raw.replace(/\n+/g, " ").trim();
  const sentences = splitSentences(oneLine);
  if (sentences.length < 2) return [raw];

  const roll = seedHash(seed + raw) % 100;
  if (roll >= 20) return [raw];

  let out: string[];
  if (sentences.length === 2) {
    out = [sentences[0]!, sentences[1]!];
  } else {
    const first = sentences[0]!;
    const last = sentences[sentences.length - 1]!;
    const middle = sentences.slice(1, -1).join(" ").trim();

    if (middle.length >= 24) {
      out = [first, middle, last].filter((x) => x.length > 0);
    } else {
      out = [first, sentences.slice(1).join(" ").trim()].filter((x) => x.length > 0);
    }
  }

  return collapseChunks(out, maxChunks);
}
