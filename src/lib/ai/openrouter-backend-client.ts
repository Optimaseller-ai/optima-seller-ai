import "server-only";

import type { OpenRouterMessage } from "./openrouter";

function backendBaseUrl(): string | null {
  const url = process.env.OPTIMA_AI_BACKEND_URL?.trim().replace(/\/$/, "");
  return url && url.length > 0 ? url : null;
}

function backendSecret(): string | null {
  const s = process.env.OPTIMA_AI_BACKEND_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function isOpenRouterDelegatedToBackend(): boolean {
  return Boolean(backendBaseUrl() && backendSecret());
}

async function postBackend<T>(path: string, body: unknown): Promise<T> {
  const base = backendBaseUrl();
  const secret = backendSecret();
  if (!base || !secret) {
    throw new Error("OPTIMA_AI_BACKEND_URL or OPTIMA_AI_BACKEND_SECRET not configured");
  }

  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await resp.json().catch(() => ({}))) as T & { error?: string; message?: string };

  if (!resp.ok) {
    const msg = typeof json?.message === "string" ? json.message : json?.error ?? `Backend HTTP ${resp.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  return json;
}

/** Appel OpenRouter via Railway — remplace l’appel direct serverless. */
export async function openRouterChatViaBackend(args: {
  model?: string;
  messages: OpenRouterMessage[];
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  const data = await postBackend<{ ok: boolean; content: string }>("/v1/llm/chat", {
    model: args.model,
    messages: args.messages,
    max_tokens: args.maxTokens,
    timeout_ms: args.timeoutMs,
  });

  if (!data?.content?.trim()) {
    throw new Error("Backend returned empty OpenRouter content");
  }

  console.log("[OPTIMA_AI] openrouter_via_backend", { messageCount: args.messages.length });
  return data.content.trim();
}

export async function openRouterEmbedViaBackend(args: {
  model?: string;
  input: string;
  timeoutMs?: number;
}): Promise<number[]> {
  const data = await postBackend<{ ok: boolean; embedding: number[] }>("/v1/llm/embed", {
    model: args.model,
    input: args.input,
    timeout_ms: args.timeoutMs,
  });

  if (!Array.isArray(data.embedding) || data.embedding.length < 10) {
    throw new Error("Backend returned invalid embedding");
  }

  return data.embedding;
}
