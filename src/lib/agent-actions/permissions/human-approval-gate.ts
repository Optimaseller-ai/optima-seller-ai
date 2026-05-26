import "server-only";

import type { AgentActionKind } from "../context/agent-action-types";

const FINANCIAL_KINDS: Partial<Record<AgentActionKind, true>> = {
  request_payment: true,
  create_quote: true,
  create_order: true,
  book_delivery: true,
};

/** Messages « massifs » détectés dans payload — validation admin requise */
export function payloadLooksMassBroadcast(payload?: Record<string, unknown>): boolean {
  const audience = Number(payload?.audienceSize ?? payload?.recipientCount ?? 0);
  return audience > 50;
}

function payloadLooksInvoiceOrLargeMoney(payload?: Record<string, unknown>): boolean {
  const blob = JSON.stringify(payload ?? "");
  if (/\b(invoice|facture|paiement\s+de\s*finition|acompte|iban|swift|r\s*i\s*b)\b/i.test(blob)) return true;
  const amt = Number(payload?.amount ?? payload?.total ?? payload?.quoteTotal ?? 0);
  return amt >= 5_000_000;
}

export type HumanApprovalDecision =
  | { required: false }
  | { required: true; pendingApprovalId: string; reason: string };

let seq = 0;
function nextId() {
  seq += 1;
  return `apr_${Date.now().toString(36)}_${seq}`;
}

const pending = new Map<string, AgentActionKind>();

export function evaluateHumanApprovalGate(args: {
  kind: AgentActionKind;
  humanApproved?: boolean;
  payload?: Record<string, unknown>;
}): HumanApprovalDecision {
  if (args.humanApproved === true) return { required: false };

  const mass = payloadLooksMassBroadcast(args.payload);
  const catalogBulk =
    args.kind === "send_catalog" &&
    (Number(args.payload?.audienceSize ?? args.payload?.recipientCount ?? 0) > 15 ||
      args.payload?.bulk === true);

  const sensitiveKind = FINANCIAL_KINDS[args.kind] === true;
  const invoiceLike =
    (args.kind === "send_email" && payloadLooksInvoiceOrLargeMoney(args.payload)) || catalogBulk;

  const sensitive = sensitiveKind || mass || invoiceLike;

  if (!sensitive) return { required: false };

  const id = nextId();
  pending.set(id, args.kind);
  return {
    required: true,
    pendingApprovalId: id,
    reason: mass ? "mass_message_requires_admin" : catalogBulk ? "catalog_bulk_requires_admin" : "sensitive_financial_action",
  };
}

export function peekPendingApprovalKind(id: string): AgentActionKind | undefined {
  return pending.get(id);
}

export function resolvePendingApproval(id: string, approve: boolean): boolean {
  if (!pending.has(id)) return false;
  pending.delete(id);
  return approve;
}
