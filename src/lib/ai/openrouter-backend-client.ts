import "server-only";

import type { OpenRouterMessage } from "./openrouter";
import {
  logOpenRouterProxyConfigOnce,
  resolveOpenRouterProxyConfig,
} from "./openrouter-proxy-config";

async function postBackend<T>(path: string, body: unknown): Promise<T> {
  const cfg = logOpenRouterProxyConfigOnce();
  if (!cfg.backendEnabled || !cfg.backendUrl) {
    throw new Error(
      `OpenRouter Railway proxy not configured (${cfg.disableReasons.join(", ") || "unknown"})`,
    );
  }

  const secret = process.env.OPTIMA_AI_BACKEND_SECRET?.trim();
  if (!secret) {
    throw new Error("OPTIMA_AI_BACKEND_SECRET missing at request time");
  }

  const url = `${cfg.backendUrl}${path}`;
  const started = Date.now();

  console.log("[OPTIMA_PROXY] railway_request_start", {
    path,
    host: (() => {
      try {
        return new URL(cfg.backendUrl!).host;
      } catch {
        return cfg.backendUrl;
      }
    })(),
  });

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[OPTIMA_PROXY] railway_request_network_error", {
      path,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const json = (await resp.json().catch(() => ({}))) as T & { error?: string; message?: string };

  if (!resp.ok) {
    console.error("[OPTIMA_PROXY] railway_request_http_error", {
      path,
      status: resp.status,
      durationMs: Date.now() - started,
      error: json?.error ?? json?.message,
    });
    const msg =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.error === "string"
          ? json.error
          : `Backend HTTP ${resp.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  console.log("[OPTIMA_PROXY] railway_request_ok", {
    path,
    status: resp.status,
    durationMs: Date.now() - started,
  });

  return json;
}

/** Appel OpenRouter via Railway — remplace l'appel direct serverless. */
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
