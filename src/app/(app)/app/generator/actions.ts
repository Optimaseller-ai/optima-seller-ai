"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runChatCore, extractItems3FromCoreMessage } from "@/lib/ai/chat-core";

const requestSchema = z.object({
  mode: z.enum(["reply", "followup", "closing", "complaint", "promo"]),
  input: z.string().min(1),
  tone: z.enum(["pro", "friendly", "direct", "luxury"]).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  formality: z.enum(["formal", "casual"]).optional(),
  model: z
    .enum([
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat-v3",
      "anthropic/claude-3.5-sonnet",
      "perplexity/sonar",
    ])
    .optional(),
  userTimezone: z.string().optional(),
});

export type GeneratorResponse = {
  items: string[];
  capabilities?: { realtime: boolean; webSearch: boolean; businessMemory: boolean };
};

type GenerationMeta =
  | null
  | {
      provider_response_id: string | null;
      provider_model: string | null;
      usage:
        | null
        | {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
      parse_fallback?: boolean;
    };

export async function generateMessages(raw: unknown): Promise<GeneratorResponse> {
  const req = requestSchema.parse(raw);

  const tz = req.userTimezone?.trim() || "Africa/Douala";

  // We keep specialization in the user message, but the engine is unified.
  const extra =
    req.tone || req.length || req.formality
      ? [
          "",
          "Preferences:",
          req.tone ? `Tone: ${req.tone}` : null,
          req.length ? `Length: ${req.length}` : null,
          req.formality ? `Formality: ${req.formality}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const prompt = [
    "Task: Generate 3 ready-to-send WhatsApp messages.",
    "Return 3 variants that are different but consistent.",
    "Keep them copy-paste friendly.",
    "",
    "User message/context:",
    req.input.trim(),
    extra,
  ].join("\n");

  const core = await runChatCore({
    message: prompt,
    history: [],
    mode: req.mode,
    model: req.model,
    userTimezone: tz,
    responseFormat: "items_3",
  });

  if (!core.ok) throw new Error(core.error);

  const items = extractItems3FromCoreMessage(core.data.message);

  // Best-effort persistence (won't block UX in demo).
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const meta: GenerationMeta = {
        provider_response_id: core.data.id,
        provider_model: core.data.model,
        usage: null,
      };
      await supabase.from("generations").insert({
        user_id: user.user.id,
        mode: req.mode,
        input: req.input,
        output: {
          items,
          provider: "openrouter",
          model: core.data.model ?? null,
          meta,
        },
        created_at: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }

  return {
    items,
    capabilities: {
      realtime: core.data.capabilities.realtime,
      webSearch: core.data.capabilities.webSearch,
      businessMemory: core.data.capabilities.businessMemory,
    },
  };
}

const refineSchema = z.object({
  instruction: z.enum(["more_selling", "shorter"]),
  text: z.string().min(1),
  tone: z.enum(["pro", "friendly", "direct", "luxury"]).optional(),
  formality: z.enum(["formal", "casual"]).optional(),
  model: z
    .enum([
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat-v3",
      "anthropic/claude-3.5-sonnet",
      "perplexity/sonar",
    ])
    .optional(),
  userTimezone: z.string().optional(),
});

export async function refineMessage(raw: unknown): Promise<{ item: string }> {
  const req = refineSchema.parse(raw);
  const tz = req.userTimezone?.trim() || "Africa/Douala";

  const instruction =
    req.instruction === "shorter"
      ? "Rewrite to be shorter (keep meaning)."
      : "Rewrite to be more sales-oriented (more convincing, clear CTA), without being aggressive.";

  const extra = [
    req.tone ? `Tone: ${req.tone}` : null,
    req.formality ? `Formality: ${req.formality}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    instruction,
    extra ? `\nPreferences:\n${extra}` : "",
    "",
    "Message:",
    req.text.trim(),
  ].join("\n");

  const core = await runChatCore({
    message: prompt,
    history: [],
    mode: "business_chat",
    model: req.model,
    userTimezone: tz,
    responseFormat: "single",
  });
  if (!core.ok) throw new Error(core.error);
  return { item: core.data.message.trim() };
}

