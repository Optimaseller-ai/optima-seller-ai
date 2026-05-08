import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { openRouterChat } from "@/lib/ai/openrouter";
import { getBusinessContext } from "@/lib/ai/business-context";
import { getNextRelanceAt, isClosedStatus, type ConversationStatus } from "@/lib/chat/relance";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: string };

function relanceNumberToLabel(n: number) {
  const x = Math.max(1, Math.min(3, Math.floor(n)));
  return x === 1 ? "Relance 1 (30 min)" : x === 2 ? "Relance 2 (1h)" : "Relance 3 (24h)";
}

export async function runRelanceForConversation(args: { conversationId: string; force?: boolean }) {
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("id,agent_id,session_id,status,last_ai_message_at,last_user_message_at,relance_count,next_relance_at,messages")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (convErr) throw convErr;
  if (!conv?.id) return { ok: false as const, reason: "not_found" as const };

  const status = (typeof (conv as any).status === "string" ? (conv as any).status : "active") as ConversationStatus;
  if (isClosedStatus(status)) return { ok: false as const, reason: "closed" as const };

  const relanceCount = typeof (conv as any).relance_count === "number" ? (conv as any).relance_count : 0;
  if (relanceCount >= 3) return { ok: false as const, reason: "maxed" as const };

  const due = (conv as any).next_relance_at ? new Date(String((conv as any).next_relance_at)) : null;
  if (!args.force && due && due.getTime() > now.getTime()) return { ok: false as const, reason: "not_due" as const };

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id,user_id,is_active,name,slug")
    .eq("id", conv.agent_id)
    .maybeSingle();
  if (agentErr) throw agentErr;
  if (!agent?.id || !agent.is_active) return { ok: false as const, reason: "unknown_agent" as const };

  const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", agent.user_id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, reason: "plan" as const };

  const { data: prof } = await admin
    .from("profiles")
    .select("business_name,shop_name,full_name,first_name,business_type,goal,country,city,offer,brand_tone,response_style,language")
    .eq("id", agent.user_id)
    .maybeSingle();

  const profileSummary = [
    prof?.business_name || prof?.shop_name ? `Business: ${prof?.business_name ?? prof?.shop_name}` : null,
    prof?.business_type ? `Type: ${prof.business_type}` : null,
    prof?.country || prof?.city ? `Localisation: ${(prof?.city ?? "").trim()} ${(prof?.country ?? "").trim()}`.trim() : null,
    prof?.offer ? `Offre: ${prof.offer}` : null,
    (prof as any)?.brand_tone ? `Ton: ${(prof as any).brand_tone}` : null,
    (prof as any)?.response_style ? `Style: ${(prof as any).response_style}` : null,
    (prof as any)?.language ? `Langue: ${(prof as any).language}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const history = (Array.isArray((conv as any).messages) ? ((conv as any).messages as any[]) : []) as StoredMessage[];
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const ctx = await getBusinessContext(agent.user_id, lastUser || "catalogue");

  const nextRelanceNumber = relanceCount + 1;
  const label = relanceNumberToLabel(nextRelanceNumber);

  const prompt = [
    "Tu dois envoyer UNE relance Ã  un prospect silencieux dans un chat web.",
    "",
    "RÃˆGLES STRICTES (OBLIGATOIRES):",
    "- Message trÃ¨s court (1â€“2 phrases).",
    "- Ton humain, poli, naturel.",
    "- ZÃ©ro pression, pas de spam, pas de Â« achetez maintenant Â», pas d'urgence artificielle.",
    "- Poser une question ouverte (une seule).",
    "- Apporter une valeur (proposer aide / rÃ©sumÃ© / conseil / option budget / disponibilitÃ©).",
    "- Ne pas rÃ©pÃ©ter mot Ã  mot une relance prÃ©cÃ©dente.",
    "- Pas d'emoji obligatoire (1 max si naturel).",
    "",
    `Contexte business (si pertinent):\n${profileSummary || "N/A"}`,
    "",
    `Catalogue/Docs pertinents:\n${ctx.context || "N/A"}`,
    "",
    `Relance Ã Ã©crire: ${label}`,
    "",
    "Dernier message du prospect (si vide, rester gÃ©nÃ©ral):",
    lastUser || "(aucun)",
  ].join("\n");

  const relanceText = await openRouterChat({
    messages: [
      { role: "system", content: `Tu es ${agent.name}, assistant commercial (relances).` },
      { role: "user", content: prompt },
    ],
  });

  const clean = relanceText.trim();
  if (!clean) return { ok: false as const, reason: "empty" as const };

  const updatedHistory: StoredMessage[] = [...history, { role: "assistant", content: clean, ts: nowIso }];
  const nextRelanceAt = getNextRelanceAt({ relanceCount: nextRelanceNumber, from: now });

  const { error: upErr } = await admin
    .from("conversations")
    .update({
      messages: updatedHistory as any,
      status: status === "active" ? "pending" : status,
      relance_count: nextRelanceNumber,
      last_message_at: nowIso,
      last_ai_message_at: nowIso,
      next_relance_at: nextRelanceAt,
      updated_at: nowIso,
    })
    .eq("id", conv.id);
  if (upErr) throw upErr;

  return { ok: true as const, conversationId: conv.id, relance: clean, relanceCount: nextRelanceNumber, nextRelanceAt };
}

