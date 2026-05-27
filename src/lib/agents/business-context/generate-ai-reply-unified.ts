import "server-only";

import type { GenerateAIReplyResult } from "@/lib/agents/business-context/reply";
import { generateAIReply } from "@/lib/agents/business-context/reply";
import { postOptimaAiBackend } from "@/lib/ai/openrouter-backend-client";
import { isRailwayFullOrchestratorEnabled } from "@/lib/ai/openrouter-proxy-config";

export type GenerateAIReplyRailwayMeta = {
  session_id: string;
  request_id: string;
  pipeline_trace_id: string;
};

export type GenerateAIReplyUnifiedArgs = Parameters<typeof generateAIReply>[0] & {
  railwayMeta?: GenerateAIReplyRailwayMeta;
};

function mapRailwayResponse(
  j: Record<string, unknown>,
): GenerateAIReplyResult & { orchestratorPipelineDebug?: Record<string, unknown> } {
  const payload = (j.payload && typeof j.payload === "object" ? j.payload : {}) as Record<string, unknown>;
  const reply =
    typeof payload.reply === "string" ? payload.reply : typeof j.reply === "string" ? j.reply : "";

  const orchestratorPipelineDebug =
    j.orchestrator_pipeline_debug && typeof j.orchestrator_pipeline_debug === "object"
      ? (j.orchestrator_pipeline_debug as Record<string, unknown>)
      : undefined;

  return {
    reply,
    socialOnlyMode: payload.socialOnlyMode as GenerateAIReplyResult["socialOnlyMode"],
    replyTransformationChain: payload.replyTransformationChain as GenerateAIReplyResult["replyTransformationChain"],
    supervisorInsights: payload.supervisorInsights as GenerateAIReplyResult["supervisorInsights"],
    emotionalSupervisorInsights: payload.emotionalSupervisorInsights as GenerateAIReplyResult["emotionalSupervisorInsights"],
    personalitySupervisorInsights: payload.personalitySupervisorInsights as GenerateAIReplyResult["personalitySupervisorInsights"],
    socialSupervisorInsights: payload.socialSupervisorInsights as GenerateAIReplyResult["socialSupervisorInsights"],
    replyOwnership: payload.replyOwnership as GenerateAIReplyResult["replyOwnership"],
    liveOrchestrator: payload.liveOrchestrator as GenerateAIReplyResult["liveOrchestrator"],
    orchestratorPipelineDebug,
  };
}

/**
 * Runs `generateAIReply` locally, or delegates the full orchestration brain to Railway
 * when `OPTIMA_AI_BACKEND_URL` + secret are set and `OPTIMA_RAILWAY_FULL_ORCHESTRATOR` is not disabled.
 */
export async function generateAIReplyUnified(
  args: GenerateAIReplyUnifiedArgs,
): Promise<GenerateAIReplyResult & { orchestratorPipelineDebug?: Record<string, unknown> }> {
  const { railwayMeta, ...localArgs } = args;

  if (isRailwayFullOrchestratorEnabled()) {
    if (!railwayMeta) {
      throw new Error("[OPTIMA_REPLY_PIPELINE] railway_full_orchestrator_enabled_missing_railwayMeta");
    }
    console.log("[OPTIMA_REPLY_PIPELINE] delegating_to_railway", {
      session_id: railwayMeta.session_id,
      request_id: railwayMeta.request_id,
    });
    try {
      const data = await postOptimaAiBackend<Record<string, unknown>>("/v1/chat/reply", {
        session_id: railwayMeta.session_id,
        request_id: railwayMeta.request_id,
        pipeline_trace_id: railwayMeta.pipeline_trace_id,
        message: localArgs.message,
        user_id: localArgs.userId,
        agent_id: localArgs.agentId,
        agent_name: localArgs.agentName,
        agent_personality: localArgs.agentPersonality,
        sales_style: localArgs.salesStyle,
        business_name: localArgs.businessName,
        conversation_state: localArgs.conversationState,
        history: localArgs.history,
        agent_role: localArgs.agentRole,
        agent_tone: localArgs.agentTone,
        persona_key: localArgs.personaKey ?? null,
        followup_after_hold: localArgs.followupAfterHold,
      });
      return mapRailwayResponse(data);
    } catch (e) {
      const err = e as Error & { status?: number };
      const em = String(err.message ?? "");
      if (err.status === 409 && (em.includes("duplicate") || em === "duplicate_request")) {
        throw new Error("RAILWAY_DUPLICATE_REPLY_REQUEST");
      }
      if (err.status === 409 && (em.includes("stale") || em === "stale_reply_turn")) {
        throw new Error("RAILWAY_STALE_REPLY_TURN");
      }
      throw e;
    }
  }

  return generateAIReply(localArgs);
}
