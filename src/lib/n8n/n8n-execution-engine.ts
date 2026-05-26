import "server-only";

import type { AutomationActionJob } from "@/lib/automation/action-queue";
import { executeAutomationJob, scanAndExecuteAutomationJobs } from "@/lib/automation/automation-execution-engine";

import { dispatchN8nAction } from "./dispatch/n8n-action-dispatcher";
import type { N8nDispatchResult } from "./dispatch/n8n-action-dispatcher";
import { handleN8nCallback, parseN8nCallbackBody } from "./dispatch/n8n-response-handler";
import type { ExecuteAutomationIntentInput } from "@/lib/automation/execution-orchestrator";
import { executeAutomationIntent } from "@/lib/automation/execution-orchestrator";

/**
 * Point d’entrée unique — IA → orchestrator → automation queue → n8n.
 * L’IA ne doit jamais appeler dispatch directement.
 */

/** Exécute une job de la file via la couche n8n (appelé par automation-execution-engine). */
export async function executeN8nJobFromQueue(job: AutomationActionJob): Promise<N8nDispatchResult> {
  return dispatchN8nAction(job);
}

/** Cycle file + n8n (délègue au moteur automation existant). */
export async function runN8nExecutionCycle(limit = 20) {
  return scanAndExecuteAutomationJobs(limit);
}

/** Orchestration intention → queue → n8n (chemin recommandé). */
export async function orchestrateIntentToN8n(input: ExecuteAutomationIntentInput) {
  return executeAutomationIntent(input);
}

/** Callback entrant n8n. */
export async function ingestN8nWebhookCallback(args: {
  body: unknown;
  rawBody: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}) {
  const payload = parseN8nCallbackBody(args.body);
  if (!payload) return { ok: false, reason: "invalid_payload" };
  return handleN8nCallback({
    payload,
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    timestampHeader: args.timestampHeader,
  });
}

/** Exécution directe d’une job par id (cron / admin). */
export async function executeN8nJobById(jobId: string) {
  const result = await executeAutomationJob(jobId);
  return result;
}

export { dispatchN8nAction, handleN8nCallback, parseN8nCallbackBody };
