/**
 * Orchestrateur automation — un tour de conversation → triggers → relance → n8n.
 */

import { enqueueAutomationEvent, peekPendingEvents } from "../event-queue";
import { logAutomation } from "../event-log";
import { deriveConversationTriggers, triggersToN8nEvents } from "../triggers/event-trigger-engine";
import { decideSmartFollowup } from "../followups/smart-followup-engine";
import { inferPipelineStage } from "../crm/sales-pipeline-memory";
import { syncAutomationMemory } from "../memory-sync/memory-sync-engine";
import { flushQueuedEventToN8n } from "../integrations/n8n-webhook-client";
import { draftWhatsappFollowup, triggerToWhatsappKind } from "../whatsapp/whatsapp-followup-engine";
import { suggestAutoActions } from "./auto-actions";
import type { ConversationAutomationContext } from "../types";
import { evolveLeadTemperature, scoreLeadTemperature } from "@/lib/prospect/lead-scoring/lead-temperature";
import { enqueueSmartEmailFollowupSideEffects } from "../smart-email-followup-flow";
import { analyzeAutomationIntents } from "../automation-intent-engine";
import { scheduleAutomationAction } from "../action-queue";
import { resolveExecutionChannel } from "../channel-router";
import { resolveWorkflowRoute } from "../workflow-mapper";
import {
  canExecuteAutomationAction,
  inputFromAutomationContext,
  resolveActionChannelFromEvent,
} from "../rate-limit/automation-rate-limiter";
import { evaluateAutomationEligibility } from "../automation-eligibility-engine";

export type ConversationAutomationResult = {
  pipelineStage: ReturnType<typeof inferPipelineStage>;
  triggers: ReturnType<typeof deriveConversationTriggers>;
  followup: ReturnType<typeof decideSmartFollowup>;
  suggestedActions: ReturnType<typeof suggestAutoActions>;
  n8nEvents: string[];
  whatsappPreview?: string;
};

/**
 * Point d’entrée après chaque message prospect (non bloquant côté appelant).
 */
export async function processConversationAutomation(
  rawCtx: ConversationAutomationContext,
): Promise<ConversationAutomationResult> {
  const eligibility = evaluateAutomationEligibility(rawCtx);
  if (!eligibility.eligible) {
    const stage = eligibility.socialOnly.active ? ("social" as const) : inferPipelineStage(rawCtx);
    return {
      pipelineStage: stage,
      triggers: deriveConversationTriggers(rawCtx),
      followup: { shouldFollowUp: false, scheduledFor: null, trigger: null, channel: "chat" as const },
      suggestedActions: [],
      n8nEvents: [],
    };
  }

  const leadTemp =
    rawCtx.leadTemperature ??
    rawCtx.prospectLead?.leadTemperature ??
    scoreLeadTemperature({
      turnCount: rawCtx.conversationState?.stats?.turn_count,
      lastUserMessage: rawCtx.lastUserMessage,
    });

  const ctx: ConversationAutomationContext = {
    ...rawCtx,
    leadTemperature: rawCtx.prospectLead
      ? evolveLeadTemperature(rawCtx.prospectLead, {
          turnCount: rawCtx.conversationState?.stats?.turn_count,
          lastUserMessage: rawCtx.lastUserMessage,
        })
      : leadTemp,
    pipelineStage: rawCtx.pipelineStage ?? inferPipelineStage(rawCtx),
    lastProspectActiveAt: rawCtx.lastProspectActiveAt ?? Date.now(),
  };

  const memoryPatch = syncAutomationMemory(ctx);
  if (memoryPatch.pipelineStage) ctx.pipelineStage = memoryPatch.pipelineStage;

  const triggers = deriveConversationTriggers(ctx);
  const followup = decideSmartFollowup(ctx, triggers);
  const n8nEvents = triggersToN8nEvents(triggers);

  for (const event of n8nEvents) {
    if (event === "message.received") continue;

    const top = triggers.find((t) => t.event === event);
    const channel = resolveActionChannelFromEvent(event, top?.channel);
    const rateGate = await canExecuteAutomationAction(
      inputFromAutomationContext(ctx, { event, actionChannel: channel }),
    );
    if (!rateGate.allowed) continue;

    enqueueAutomationEvent({
      event,
      trigger: top?.kind,
      idempotencyParts: [ctx.agentId, ctx.sessionId, event, ctx.lastUserMessage.slice(0, 40)],
      payload: {
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        conversationId: ctx.conversationId,
        userId: ctx.userId,
        scheduledFor: followup.scheduledFor,
        lastUserMessage: ctx.lastUserMessage.slice(0, 500),
        triggerKind: top?.kind,
      },
    });
  }

  if (followup.shouldFollowUp && followup.trigger) {
    const fuChannel = resolveActionChannelFromEvent(
      "followup.required",
      followup.channel,
    );
    const fuGate = await canExecuteAutomationAction(
      inputFromAutomationContext(ctx, {
        event: "followup.required",
        actionChannel: fuChannel,
        actionType:
          followup.channel === "whatsapp"
            ? "SEND_WHATSAPP_FOLLOWUP"
            : followup.channel === "email"
              ? "SEND_PRODUCT_EMAIL"
              : "FOLLOWUP",
      }),
    );
    if (!fuGate.allowed) {
      return {
        pipelineStage: ctx.pipelineStage!,
        triggers,
        followup: { ...followup, shouldFollowUp: false, stopReason: fuGate.reason },
        suggestedActions: suggestAutoActions(ctx),
        n8nEvents,
        whatsappPreview: undefined,
      };
    }

    enqueueAutomationEvent({
      event: "followup.required",
      trigger: followup.trigger,
      idempotencyParts: [ctx.agentId, ctx.sessionId, "followup", followup.scheduledFor ?? ""],
      payload: {
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        conversationId: ctx.conversationId,
        userId: ctx.userId,
        channel: followup.channel,
        scheduledFor: followup.scheduledFor,
        messageHint: followup.messageHint,
        triggerKind: followup.trigger,
      },
    });

    if (followup.scheduledFor) {
      const intents = analyzeAutomationIntents(ctx);
      const intent =
        followup.channel === "whatsapp"
          ? intents.find((i) => i.actionType === "SEND_WHATSAPP_FOLLOWUP") ?? intents[0]
          : followup.channel === "email"
            ? intents.find((i) => i.actionType === "SEND_PRODUCT_EMAIL" || i.actionType === "COLLECT_EMAIL_AND_SEND_DETAILS") ??
              intents[0]
            : intents[0];

      if (intent) {
        const route = resolveWorkflowRoute(intent);
        const channel = resolveExecutionChannel({ intent, ctx });
        void scheduleAutomationAction({
          event: route.event,
          ctx,
          intent,
          routedChannel: channel,
          scheduledFor: followup.scheduledFor,
          humanGateSatisfied: true,
        }).catch(() => {});
      }
    }
  }

  enqueueSmartEmailFollowupSideEffects({
    ctx,
    capturedEmail: ctx.prospectLead?.email ?? undefined,
  });

  const suggestedActions = suggestAutoActions(ctx);

  let whatsappPreview: string | undefined;
  if (followup.shouldFollowUp && followup.trigger && (followup.channel === "whatsapp" || ctx.prospectLead?.phone)) {
    const draft = draftWhatsappFollowup({
      kind: triggerToWhatsappKind(followup.trigger),
      trigger: followup.trigger,
      profile: ctx.prospectLead,
      agentName: ctx.agentName ?? "Conseiller",
      businessName: ctx.businessName ?? "Boutique",
      lang: ctx.lang,
      seed: ctx.sessionId + followup.trigger,
    });
    whatsappPreview = draft.body;
  }

  logAutomation({
    level: "info",
    message: "conversation_automation_processed",
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    meta: {
      pipelineStage: ctx.pipelineStage,
      triggerCount: triggers.length,
      followup: followup.shouldFollowUp,
      actions: suggestedActions,
    },
  });

  void flushAutomationQueueToN8n(ctx).catch(() => {});

  return {
    pipelineStage: ctx.pipelineStage!,
    triggers,
    followup,
    suggestedActions,
    n8nEvents,
    whatsappPreview,
  };
}

async function flushAutomationQueueToN8n(ctx: ConversationAutomationContext) {
  const pending = peekPendingEvents(10);
  for (const row of pending) {
    await flushQueuedEventToN8n(row, ctx);
  }
}
