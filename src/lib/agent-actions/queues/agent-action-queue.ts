/**
 * File d’actions différées — base pour workers, WhatsApp Cloud API, voix, centre d’appels.
 */

import type { AgentActionRequest } from "../context/agent-action-types";

export type DeferredAgentChannel = "whatsapp_cloud" | "email" | "voice" | "calendar" | "sms";

export type QueuedAgentAction = {
  id: string;
  runAfterIso: string;
  request: AgentActionRequest;
  channel?: DeferredAgentChannel;
  /** Pour routing multi-canal futur */
  priority?: number;
};
