/**
 * Après une promesse « je vous envoie par email » — enchaîne workflow + relance planifiée.
 */

import { enqueueAutomationEvent } from "./event-queue";
import { decideSmartFollowup } from "./followups/smart-followup-engine";
import { scheduleFollowup } from "./scheduler/smart-scheduler";
import { deriveConversationTriggers } from "./triggers/event-trigger-engine";
import type { ConversationAutomationContext } from "./types";

export function detectAssistantEmailOffer(lastAssistantReply?: string): boolean {
  const a = String(lastAssistantReply ?? "");
  return (
    /\b(envoyer|envoyez|vous\s+envoie|vous\s+transmet|par\s+mail|par\s+courriel|email|e-mail)\b/i.test(a) &&
    /\b(détail|fiche|catalogue|catalog|pdf|offre|liste|tarif|prix)\b/i.test(a)
  );
}

export function extractEmailFromUserMessage(text: string): string | null {
  const m = String(text ?? "").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0]!.toLowerCase() : null;
}

export type SmartEmailFollowupPlan = {
  active: boolean;
  capturedEmail: string | null;
  scheduledFollowupIso: string | null;
  workflowHint: string;
};

export function planSmartEmailFollowup(args: {
  ctx: ConversationAutomationContext;
  /** Email déjà fusionné dans le profil côté appelant. */
  capturedEmail?: string | null;
}): SmartEmailFollowupPlan {
  const offered = detectAssistantEmailOffer(args.ctx.lastAssistantReply);
  const fromMsg = extractEmailFromUserMessage(args.ctx.lastUserMessage);
  const email = String(args.capturedEmail ?? "").trim() || fromMsg;

  if (!offered || !email) {
    return { active: false, capturedEmail: null, scheduledFollowupIso: null, workflowHint: "" };
  }

  const triggers = deriveConversationTriggers(args.ctx);
  const followup = decideSmartFollowup(args.ctx, triggers);
  const fallback = scheduleFollowup({
    ctx: args.ctx,
    trigger: "quotation_followup",
    prospectAngry: false,
  });

  const scheduled =
    followup.shouldFollowUp && followup.scheduledFor ? followup.scheduledFor : fallback.scheduledFor;

  return {
    active: true,
    capturedEmail: email,
    scheduledFollowupIso: scheduled,
    workflowHint: "product_followup_sequence",
  };
}

/**
 * Effets de bord file legacy (`event-queue`) — flush vers n8n inchangé (`flushQueuedEventToN8n`).
 */
export function enqueueSmartEmailFollowupSideEffects(args: {
  ctx: ConversationAutomationContext;
  capturedEmail?: string | null;
}): { eventsQueued: boolean } {
  const plan = planSmartEmailFollowup(args);
  if (!plan.active || !plan.capturedEmail) return { eventsQueued: false };

  enqueueAutomationEvent({
    event: "followup.required",
    trigger: "quotation_followup",
    idempotencyParts: [
      args.ctx.agentId,
      args.ctx.sessionId,
      "smart_email_offer",
      plan.capturedEmail,
      plan.workflowHint,
    ],
    payload: {
      agentId: args.ctx.agentId,
      sessionId: args.ctx.sessionId,
      conversationId: args.ctx.conversationId,
      userId: args.ctx.userId,
      channel: "email",
      capturedEmail: plan.capturedEmail,
      workflowHint: plan.workflowHint,
      scheduledFor: plan.scheduledFollowupIso,
      lastUserMessage: args.ctx.lastUserMessage.slice(0, 400),
    },
  });

  return { eventsQueued: true };
}
