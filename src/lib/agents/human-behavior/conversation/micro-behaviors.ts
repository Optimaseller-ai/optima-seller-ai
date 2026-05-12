import "server-only";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Micro-imperfection très rare (crédibilité), sans casser le sens. */
export function maybeHumanMicroPrefix(reply: string, seed: string): string {
  if (reply.length < 12 || reply.length > 360) return reply;
  if ((seedHash(seed + reply) >>> 0) % 52 !== 0) return reply;
  if (!/\b(monsieur|madame)\b/i.test(reply)) return reply;
  const prefixes = ["Oui pardon Monsieur. ", "Pardon Monsieur. ", "Oui Madame, pardon. "];
  return prefixes[(seedHash(seed) >>> 0) % prefixes.length] + reply;
}
