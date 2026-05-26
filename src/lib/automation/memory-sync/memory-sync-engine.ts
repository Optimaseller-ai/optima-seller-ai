/**
 * Memory Sync — synchronise pipeline + lead dans l’état conversationnel.
 */

import type { ConversationAutomationContext, SalesPipelineStage } from "../types";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { inferPipelineStage, formatPipelineMemoryBlock } from "../crm/sales-pipeline-memory";

export type AutomationMemoryPatch = {
  pipelineStage: SalesPipelineStage;
  memoryLines: string[];
  conversationStatePatch: Partial<SellerBehaviorConversationState>;
};

export function syncAutomationMemory(ctx: ConversationAutomationContext): AutomationMemoryPatch {
  if (ctx.conversationState?.socialOnlyMode?.active === true) {
    const lang = ctx.lang ?? ctx.conversationState?.language ?? "fr";
    return {
      pipelineStage: "social",
      memoryLines: ["Pipeline: social.", "Température lead: neutral."],
      conversationStatePatch: {
        memory: [
          "Pipeline: social.",
          "Température lead: neutral.",
          ...(Array.isArray(ctx.conversationState?.memory) ? ctx.conversationState!.memory! : []).filter(
            (l) => !l.startsWith("Pipeline:") && !l.startsWith("Température lead:"),
          ),
        ].slice(0, 20),
        automation: {
          pipelineStage: "social",
          leadTemperature: "neutral",
          lastProcessedAt: Date.now(),
        },
      },
    };
  }

  const stage = inferPipelineStage(ctx);
  const lang = ctx.lang ?? ctx.conversationState?.language ?? "fr";
  const pipelineLine = formatPipelineMemoryBlock(stage, lang);
  const temp = ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature ?? "cold";

  const memoryLines = [
    `Pipeline: ${stage}.`,
    `Température lead: ${temp}.`,
    ctx.prospectLead?.primaryNeed ? `Besoin: ${ctx.prospectLead.primaryNeed}.` : null,
  ].filter(Boolean) as string[];

  const prevMemory = Array.isArray(ctx.conversationState?.memory) ? ctx.conversationState!.memory! : [];
  const mergedMemory = [
    ...memoryLines,
    ...prevMemory.filter((l) => !l.startsWith("Pipeline:") && !l.startsWith("Température lead:")),
  ].slice(0, 20);

  return {
    pipelineStage: stage,
    memoryLines,
    conversationStatePatch: {
      memory: mergedMemory,
      prospectLead: ctx.prospectLead
        ? { ...ctx.prospectLead, leadTemperature: temp }
        : ctx.conversationState?.prospectLead,
    },
  };
}

/** Sérialise pour stockage jsonb (conversation_state.automation). */
export function buildAutomationStateSnapshot(ctx: ConversationAutomationContext, stage: SalesPipelineStage) {
  return {
    pipelineStage: stage,
    leadTemperature: ctx.leadTemperature,
    lastProcessedAt: Date.now(),
    lastUserSnippet: ctx.lastUserMessage.slice(0, 120),
  };
}
