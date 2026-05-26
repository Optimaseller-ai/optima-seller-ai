import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { SupervisionAlert } from "./supervision-types";

function alertId(prefix: string, conversationId: string): string {
  return `${prefix}_${conversationId}_${Date.now()}`;
}

export function detectSupervisionAlerts(args: {
  conversationId: string;
  conversationState?: SellerBehaviorConversationState;
  status?: string;
  relanceCount?: number;
  lastUserAt?: string | null;
  lastAiAt?: string | null;
}): SupervisionAlert[] {
  const out: SupervisionAlert[] = [];
  const now = Date.now();
  const state = args.conversationState;
  const temp = state?.liveOrchestrator?.prospectTemperature;
  const emotion = state?.liveOrchestrator?.emotionalState ?? state?.prospectEmotionalMemory?.kind;
  const trust = state?.salesSignalsMemory?.trustLevel01;
  const intent = state?.liveOrchestrator?.activeSalesOpportunity;

  if (emotion === "anger" || emotion === "frustration" || emotion === "frustrated") {
    out.push({
      id: alertId("frustrated", args.conversationId),
      severity: "warning",
      title: "Prospect frustré",
      body: "Ton à adoucir — éviter relance commerciale agressive.",
      conversationId: args.conversationId,
      at: new Date().toISOString(),
    });
  }

  if (temp === "hot" || temp === "ready") {
    out.push({
      id: alertId("hot", args.conversationId),
      severity: temp === "ready" ? "critical" : "warning",
      title: temp === "ready" ? "Forte intention d’achat" : "Prospect très intéressé",
      body: "Prioriser réponse rapide ou validation humaine si action sensible.",
      conversationId: args.conversationId,
      at: new Date().toISOString(),
    });
  }

  if (typeof trust === "number" && trust < 0.35) {
    out.push({
      id: alertId("churn", args.conversationId),
      severity: "warning",
      title: "Risque perte client",
      body: "Confiance basse — privilégier réassurance factuelle.",
      conversationId: args.conversationId,
      at: new Date().toISOString(),
    });
  }

  const habits = [
    ...(state?.prospectProfile?.habits ?? []),
    ...(state?.socialConversationHabits ?? []),
  ];
  if (habits.some((t: string) => /vip|premium|gros/i.test(String(t)))) {
    out.push({
      id: alertId("vip", args.conversationId),
      severity: "info",
      title: "Prospect VIP",
      body: "Traitement prioritaire recommandé.",
      conversationId: args.conversationId,
      at: new Date().toISOString(),
    });
  }

  if (args.status === "abandoned" || (intent && temp === "warm" && args.lastUserAt)) {
    const idleMs = args.lastUserAt ? now - new Date(args.lastUserAt).getTime() : 0;
    if (idleMs > 2 * 60 * 60 * 1000) {
      out.push({
        id: alertId("cart", args.conversationId),
        severity: "info",
        title: "Abandon possible",
        body: "Prospect inactif après intérêt — relance douce envisageable.",
        conversationId: args.conversationId,
        at: new Date().toISOString(),
      });
    }
  }

  return out.slice(0, 6);
}
