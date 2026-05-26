import "server-only";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor?: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry intelligent pour webhooks / IO fragile. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryPolicy & { isRetryable?: (err: unknown) => boolean },
): Promise<{ ok: true; value: T; attempts: number } | { ok: false; error: string; attempts: number }> {
  const max = Math.max(1, opts.maxAttempts);
  const factor = opts.backoffFactor ?? 2;
  let lastErr = "";

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const value = await fn(attempt);
      return { ok: true, value, attempts: attempt };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      const retryable = opts.isRetryable ? opts.isRetryable(e) : true;
      if (!retryable || attempt === max) break;
      await sleep(opts.baseDelayMs * factor ** (attempt - 1));
    }
  }

  return { ok: false, error: lastErr, attempts: max };
}
