/**
 * Next.js instrumentation — exécuté une fois au démarrage du serveur Node.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { logConversationsSchemaHealthOnce } = await import("@/lib/supabase/conversations-schema-health");
    await logConversationsSchemaHealthOnce();
  } catch (e) {
    console.error("[INSTRUMENTATION] conversations schema health failed", e);
  }
}
