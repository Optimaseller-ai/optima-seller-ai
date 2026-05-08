import "server-only";

import { serverEnv } from "@/lib/server-env";

type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openRouterChat(args: { model?: string; messages: OpenRouterMessage[] }) {
  if (!serverEnv.OPENROUTER_API_KEY) {
    console.error("[openRouterChat] Missing OPENROUTER_API_KEY");
    throw new Error("Missing OPENROUTER_API_KEY on server.");
  }
  
  const model = args.model ?? serverEnv.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  console.log("[openRouterChat] Calling OpenRouter...", { model, messageCount: args.messages.length });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const startTime = Date.now();
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: args.messages,
      temperature: 0.4,
    }),
  });

  const duration = Date.now() - startTime;
  console.log(`[openRouterChat] Response received in ${duration}ms`, { status: resp.status });

  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `OpenRouter error (HTTP ${resp.status})`;
    console.error("[openRouterChat] API error", { status: resp.status, message: msg, error: json?.error });
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("[openRouterChat] Invalid response format", { hasContent: !!content, contentType: typeof content });
    throw new Error("OpenRouter: empty response.");
  }
  
  console.log("[openRouterChat] Success", { contentLength: content.length });
  return content.trim();
}

export async function openRouterEmbed(args: { model?: string; input: string }) {
  if (!serverEnv.OPENROUTER_API_KEY) {
    console.error("[openRouterEmbed] Missing OPENROUTER_API_KEY");
    throw new Error("Missing OPENROUTER_API_KEY on server.");
  }
  
  const model = args.model ?? serverEnv.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  console.log("[openRouterEmbed] Generating embedding...", { model, inputLength: args.input.length });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input: args.input }),
  });

  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `OpenRouter error (HTTP ${resp.status})`;
    console.error("[openRouterEmbed] API error", { status: resp.status, message: msg });
    throw new Error(msg);
  }

  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length < 10) {
    console.error("[openRouterEmbed] Invalid embedding", { hasVec: !!vec, length: vec?.length });
    throw new Error("OpenRouter: invalid embedding response.");
  }
  
  console.log("[openRouterEmbed] Success", { embeddingDim: vec.length });
  return vec as number[];
}
