import "server-only";

import type { SupervisionFeedItem, SupervisionAlert } from "./supervision-types";

export type SupervisionBusEvent =
  | { type: "feed"; item: SupervisionFeedItem }
  | { type: "alert"; alert: SupervisionAlert }
  | { type: "invalidate" };

const MAX_FEED = 120;
const MAX_ALERTS = 40;

const feedRing: SupervisionFeedItem[] = [];
const alertRing: SupervisionAlert[] = [];
let version = 0;

export function emitSupervisionFeedItem(item: SupervisionFeedItem): void {
  feedRing.unshift(item);
  if (feedRing.length > MAX_FEED) feedRing.length = MAX_FEED;
  version += 1;
}

export function emitSupervisionAlert(alert: SupervisionAlert): void {
  alertRing.unshift(alert);
  if (alertRing.length > MAX_ALERTS) alertRing.length = MAX_ALERTS;
  version += 1;
}

export function bumpSupervisionCache(): void {
  version += 1;
}

export function getSupervisionBusSnapshot(): {
  version: number;
  feed: SupervisionFeedItem[];
  alerts: SupervisionAlert[];
} {
  return {
    version,
    feed: [...feedRing],
    alerts: [...alertRing],
  };
}
