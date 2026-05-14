import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { isPostgrestUnknownColumnError, parsePostgrestUnknownColumnName } from "@/lib/chat/conversation-state-db";

/** Colonnes attendues pour l’UI / relances / analytics (hors cœur messages). */
const CONVERSATIONS_HEALTH_COLUMNS = [
  "last_ai_message_at",
  "last_user_message_at",
  "last_message_preview",
  "updated_at",
  "conversation_state",
  "last_message_at",
  "relance_count",
  "next_relance_at",
] as const;

let loggedOnce = false;

/**
 * Au démarrage serveur : une passe diagnostic (logs uniquement, ne jette pas).
 */
export async function logConversationsSchemaHealthOnce(): Promise<void> {
  if (loggedOnce) return;
  loggedOnce = true;

  const admin = createAdminClientSafe();
  if (!admin) {
    console.warn("[CONVERSATIONS_SCHEMA] Skip: admin client indisponible (env Supabase).");
    return;
  }

  const missing: string[] = [];
  for (const col of CONVERSATIONS_HEALTH_COLUMNS) {
    try {
      const { error } = await admin.from("conversations").select(`id,${col}`).limit(1);
      if (error && isPostgrestUnknownColumnError(error)) {
        const parsed = parsePostgrestUnknownColumnName(error);
        if (parsed === col) missing.push(col);
        else if (String(error.message ?? "").includes(col)) missing.push(col);
      } else if (error) {
        console.warn("[CONVERSATIONS_SCHEMA] check column", col, error);
      }
    } catch (e) {
      console.warn("[CONVERSATIONS_SCHEMA] check column throw", col, e);
    }
  }

  if (missing.length) {
    console.error(
      "[CONVERSATIONS_SCHEMA] Colonnes manquantes sur public.conversations:",
      missing.join(", "),
      "— appliquer supabase/migrations (ex. 2026-05-14_conversations_metadata_columns.sql, 2026-05-06_conversation_relance.sql, 2026-05-11_conversation_seller_state.sql).",
    );
  } else {
    console.log("[CONVERSATIONS_SCHEMA] Colonnes critiques présentes (aperçu PostgREST OK).");
  }
}
