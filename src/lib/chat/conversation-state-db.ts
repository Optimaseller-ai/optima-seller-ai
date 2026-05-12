/**
 * PostgREST PGRST204 quand la colonne `conversations.conversation_state`
 * n’existe pas encore (migration non appliquée sur Supabase).
 */
export function isMissingConversationStateColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null | undefined;
  if (!e?.code) return false;
  return e.code === "PGRST204" && String(e.message ?? "").includes("conversation_state");
}
