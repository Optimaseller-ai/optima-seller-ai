import "server-only";

import { serverEnv } from "@/lib/server-env";

type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openRouterChat(args: { model?: string; messages: OpenRouterMessage[] }) {
  if (!serverEnv.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY on server.");
  const model = args.model ?? serverEnv.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: args.messages,
      temperature: 0.4,
    }),
  });

  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `OpenRouter error (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenRouter: empty response.");
  return content.trim();
}

