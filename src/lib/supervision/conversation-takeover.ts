/**
 * Reprise de conversation par l’admin — modes AI / humain / hybride.
 * Persisté dans `conversation_state.supervision`.
 */

export type ConversationTakeoverMode = "AI_ACTIVE" | "HUMAN_ACTIVE" | "HYBRID";

export type ConversationSupervisionState = {
  takeoverMode: ConversationTakeoverMode;
  takeoverBy?: string;
  takeoverAt?: string;
};

export function readTakeoverMode(conversationState: unknown): ConversationTakeoverMode {
  const sup = (conversationState as { supervision?: ConversationSupervisionState } | null)?.supervision;
  const mode = sup?.takeoverMode;
  if (mode === "HUMAN_ACTIVE" || mode === "HYBRID" || mode === "AI_ACTIVE") return mode;
  return "AI_ACTIVE";
}

export function isAiSilentForTakeover(mode: ConversationTakeoverMode): boolean {
  return mode === "HUMAN_ACTIVE";
}

export function shouldAiReplyInHybrid(mode: ConversationTakeoverMode): boolean {
  return mode === "HYBRID" || mode === "AI_ACTIVE";
}

export function mergeTakeoverIntoConversationState(
  previous: Record<string, unknown> | undefined,
  args: { mode: ConversationTakeoverMode; supervisorUserId?: string },
): Record<string, unknown> {
  const base = { ...(previous ?? {}) };
  const prevSup: ConversationSupervisionState =
    (base.supervision as ConversationSupervisionState | undefined) ?? { takeoverMode: "AI_ACTIVE" };
  base.supervision = {
    ...prevSup,
    takeoverMode: args.mode,
    takeoverBy: args.supervisorUserId ?? prevSup.takeoverBy,
    takeoverAt: new Date().toISOString(),
  } satisfies ConversationSupervisionState;
  return base;
}

export function formatTakeoverLabel(mode: ConversationTakeoverMode, lang: "fr" | "en" = "fr"): string {
  if (lang === "en") {
    if (mode === "HUMAN_ACTIVE") return "Human active — AI silent";
    if (mode === "HYBRID") return "Hybrid — AI assists only when needed";
    return "AI active";
  }
  if (mode === "HUMAN_ACTIVE") return "Humain actif — IA silencieuse";
  if (mode === "HYBRID") return "Hybride — IA en soutien";
  return "IA active";
}
