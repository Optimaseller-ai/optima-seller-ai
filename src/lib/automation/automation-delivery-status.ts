/**
 * États canoniques livraison automation — supervision, n8n, file jobs.
 */

export type AutomationDeliveryStatus =
  | "queued"
  | "processing"
  | "awaiting_approval"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "retrying";

export type AutomationJobLifecycleStatus =
  | "pending"
  | "scheduled"
  | "executing"
  | "processing"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled"
  | "awaiting_human"
  | "auto_executed"
  | "soft_executed"
  | "blocked";

/** Mappe un statut job interne vers le statut produit (Supervisor / API). */
export function mapJobStatusToDeliveryStatus(
  jobStatus: AutomationJobLifecycleStatus,
): AutomationDeliveryStatus {
  switch (jobStatus) {
    case "pending":
      return "queued";
    case "scheduled":
      return "queued";
    case "executing":
    case "processing":
      return "processing";
    case "awaiting_human":
      return "awaiting_approval";
    case "retrying":
      return "retrying";
    case "cancelled":
      return "cancelled";
    case "blocked":
      return "failed";
    case "completed":
    case "auto_executed":
    case "soft_executed":
      return "delivered";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

export function mapN8nRunStatusToDelivery(
  status: string,
): AutomationDeliveryStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "processing";
    case "awaiting_human":
      return "awaiting_approval";
    case "retrying":
      return "retrying";
    case "success":
      return "delivered";
    case "failed":
      return "failed";
    case "partial":
      return "sent";
    default:
      return "processing";
  }
}
