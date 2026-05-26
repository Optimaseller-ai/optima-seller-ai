import "server-only";

export type N8nRetryPlan = {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  nextRetryAt: string;
};

const DEFAULT_MAX = 3;
const BASE_MS = 1500;

export function getN8nMaxAttempts(): number {
  const n = Number(process.env.OPTIMA_N8N_MAX_ATTEMPTS ?? DEFAULT_MAX);
  return Number.isFinite(n) && n >= 1 ? Math.min(6, Math.floor(n)) : DEFAULT_MAX;
}

export function getN8nRequestTimeoutMs(): number {
  const n = Number(process.env.OPTIMA_N8N_TIMEOUT_MS ?? 12_000);
  return Number.isFinite(n) && n >= 3000 ? Math.min(45_000, Math.floor(n)) : 12_000;
}

export function planN8nRetry(attempt: number): N8nRetryPlan {
  const maxAttempts = getN8nMaxAttempts();
  const delayMs = BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return {
    attempt,
    maxAttempts,
    delayMs,
    nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
  };
}

export function shouldRetryN8nDispatch(attempt: number, error?: string): boolean {
  if (attempt >= getN8nMaxAttempts()) return false;
  if (!error) return true;
  if (/not configured|401|403|400|invalid_signature/i.test(error)) return false;
  return true;
}
