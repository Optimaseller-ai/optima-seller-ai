/**
 * Anti-doublon — idempotence des événements / relances.
 */

const seenKeys = new Map<string, number>();
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function prune(ttlMs: number) {
  const now = Date.now();
  for (const [k, exp] of seenKeys) {
    if (exp <= now) seenKeys.delete(k);
  }
}

export function buildIdempotencyKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

export function hasRecentDuplicate(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  prune(ttlMs);
  const exp = seenKeys.get(key);
  return typeof exp === "number" && exp > Date.now();
}

export function markIdempotencyKey(key: string, ttlMs = DEFAULT_TTL_MS): void {
  seenKeys.set(key, Date.now() + ttlMs);
}

export function assertNotDuplicate(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  if (hasRecentDuplicate(key, ttlMs)) return false;
  markIdempotencyKey(key, ttlMs);
  return true;
}
