"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import { buildTimestampContext, parseNaturalLanguageDateTime } from "@/lib/datetime";

const requestSchema = z.object({
  mode: z.enum(["reply", "followup", "closing", "status"]),
  input: z.string().min(1),
  tone: z.enum(["pro", "friendly", "direct", "luxury"]).optional(),
});

export type GeneratorResponse = {
  items: string[];
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

  const gen = serverEnv.OPENROUTER_API_KEY
    ? await openRouterGenerate(req.mode, req.input)
    : { items: mockGenerate(req.mode, req.input, req.tone), meta: null as GenerationMeta };

  const items = gen.items;

  // Best-effort persistence (won't block UX in demo).
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      await supabase.from("generations").insert({
        user_id: user.user.id,
        mode: req.mode,
        input: req.input,
        output: {
          items,
          provider: serverEnv.OPENROUTER_API_KEY ? "openrouter" : "mock",
          model: serverEnv.OPENROUTER_MODEL ?? null,
          meta: gen.meta,
        },
        created_at: new Date().toISOString(),
      });
    }
  } catch {
    // Ignore in demo / missing env.
  }

  return { items };
}

async function openRouterGenerate(
  mode: "reply" | "followup" | "closing" | "status",
  input: string,
): Promise<{ items: string[]; meta: GenerationMeta }> {
  const model = serverEnv.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  const ts = buildTimestampContext();
  const resolved = parseNaturalLanguageDateTime(input);
  const system = [
    "Tu es un expert en vente sur WhatsApp pour des marchands francophones en Afrique.",
    "Ecris en francais simple, naturel, vendeur, et adapte a WhatsApp.",
    "Evite le jargon marketing. Reste court, clair, poli.",
    "Toujours terminer par une question pour faire avancer la vente.",
    `Contexte temps (reference serveur): ${ts.display} (${ts.zone}).`,
    "Si l'utilisateur parle d'un rendez-vous, horaire, rappel, planning, date limite, ouverture/fermeture:",
    "- Utilise le fuseau Africa/Douala.",
    "- Convertis 'aujourd'hui/demain/ce soir/dans X jours/vendredi prochain/semaine prochaine/week-end' en date exacte.",
    "- Normalise les heures 12h/24h correctement.",
    "- Affiche les dates en format DD/MM/YYYY et l'heure en HH:mm.",
    "- Ne propose jamais une date impossible (ex: 31/02) ni une date passee; si ambigu, pose une question.",
  ].join(" ");

  const task =
    mode === "followup"
      ? "Relance ce prospect."
      : mode === "closing"
        ? "Reponds a cette objection et aide a closer."
        : mode === "status"
          ? "Genere des idees de statuts WhatsApp vendeurs."
          : "Reponds au message du client.";

  const wants = mode === "status" ? 5 : 3;

  const calendarHint =
    resolved.ok
      ? [
          "Interpretation date/heure detectee (a respecter):",
          `${resolved.value.displayDate} ${resolved.value.displayTime} (${resolved.value.zone})`,
          "",
        ].join("\n")
      : "";

  const userPrompt = [
    `${task}`,
    "",
    calendarHint,
    "Contexte/Message:",
    input.trim(),
    "",
    `Retourne exactement ${wants} propositions sous forme de JSON strict, comme ceci:`,
    `{"items":["...","...","..."]}`,
    "Aucune autre cle. Aucun texte hors JSON.",
  ].join("\n");

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
      temperature: 0.7,
      max_tokens: mode === "status" ? 220 : 260,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenRouter error (${resp.status}): ${text.slice(0, 240)}`);
  }

  type OrChoice = { message?: { content?: unknown } };
  type OrUsage = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  type OrResponse = { choices?: OrChoice[]; usage?: OrUsage; model?: string; id?: string };
  const data = (await resp.json()) as unknown as OrResponse;
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter: invalid response.");

  const parsed = safeJsonParse(content);
  const schema = z.object({ items: z.array(z.string()).min(1) });
  const result = schema.safeParse(parsed);
  if (result.success) {
    return {
      items: result.data.items.slice(0, wants),
      meta: {
        provider_response_id: data.id ?? null,
        provider_model: data.model ?? model,
        usage: data.usage ?? null,
      },
    };
  }

  // Fallback: split lines
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s+/, ""));

  return {
    items: lines.slice(0, wants),
    meta: {
      provider_response_id: data.id ?? null,
      provider_model: data.model ?? model,
      usage: data.usage ?? null,
      parse_fallback: true,
    },
  };
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract first JSON object
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mockGenerate(
  mode: "reply" | "followup" | "closing" | "status",
  input: string,
  tone?: "pro" | "friendly" | "direct" | "luxury",
) {
  const t = tone ?? "pro";
  const prefix =
    t === "friendly"
      ? "Bonsoir !"
      : t === "direct"
        ? "Salut,"
        : t === "luxury"
          ? "Bonsoir, merci pour votre interessement."
          : "Bonsoir,";

  const clean = input.trim();
  const resolved = parseNaturalLanguageDateTime(clean);
  const when = resolved.ok ? `${resolved.value.displayDate} ${resolved.value.displayTime}` : null;

  if (mode === "status") {
    return [
      `${clean} du jour: stock limite, reservez maintenant.`,
      `Nouveau: ${clean}. Livraison rapide, paiement a la livraison possible.`,
      `Promo flash sur ${clean} aujourd'hui. Ecrivez-moi en DM.`,
      `${clean}: qualite au top. Qui veut le prix ?`,
      `Commande ${clean} disponible. Premier arrive, premier servi.`,
    ];
  }

  if (mode === "followup") {
    return [
      `${prefix} Je me permets de relancer: vous souhaitez toujours avancer sur ${clean} ?`,
      `${prefix} Petit suivi: je peux vous reserver le produit${when ? ` pour ${when}` : ""}. Vous preferez livraison aujourd'hui ou demain ?`,
      `${prefix} Derniere relance: si vous validez${when ? ` avant ${when}` : " maintenant"}, je vous fais une petite reduction. On confirme ?`,
    ];
  }

  if (mode === "closing") {
    return [
      `${prefix} Je comprends. Pour vous rassurer: paiement a la livraison possible et verification a reception. On valide la commande ?`,
      `${prefix} Ce qui bloque, c'est ${clean} ? Dites-moi votre budget, je vous propose la meilleure option.`,
      `${prefix} Si vous confirmez maintenant, je vous garde le stock et je lance la livraison. Je note votre adresse ?`,
    ];
  }

  // reply
  return [
    `${prefix} Merci pour votre message. Je vous donne le prix et les details tout de suite. Vous etes dans quelle ville ?`,
    `${prefix} Oui c'est disponible. Pouvez-vous me dire la taille/couleur que vous voulez pour que je confirme le stock ?`,
    `${prefix} Parfait. Livraison possible. Vous preferez paiement a la livraison ou Orange Money / MTN MoMo ?`,
  ];
}
