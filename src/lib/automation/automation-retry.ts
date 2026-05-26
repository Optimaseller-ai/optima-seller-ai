/**
 * Backoff progressif pour jobs automation (max 3 tentatives côté file).
 */

import "server-only";

export const AUTOMATION_MAX_ATTEMPTS = 3;

/** Délais en ms après échec : ~30s, 2min, 5min */
const BACKOFF_MS = [30_000, 120_000, 300_000] as const;

export function computeRetryBackoffMs(attemptNumber: number): number {
  const idx = Math.max(0, Math.min(BACKOFF_MS.length - 1, attemptNumber - 1));
  return BACKOFF_MS[idx]!;
}

export function computeNextRetryAtIso(attemptNumber: number, from = new Date()): string {
  return new Date(from.getTime() + computeRetryBackoffMs(attemptNumber)).toISOString();
}
