"use client";

import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { HumanDeliverySocketEvent } from "./use-human-delivery-store";

export type RealtimePlaybackManagerOpts = {
  sessionId: string;
  onEvent: (ev: HumanDeliverySocketEvent & { sequenceId?: number; fragmentIndex?: number }) => void;
  /** Clears typing if backend never sends typing_stop. */
  typingWatchdogMs?: number;
};

type IncomingPayload = {
  event?: string;
  sessionId?: string;
  session_id?: string;
  content?: string;
  durationMs?: number;
  duration_ms?: number;
  delayMs?: number;
  delay_ms?: number;
  messageId?: string;
  message_id?: string;
  sequence_id?: number;
  fragment_index?: number;
  timestamp?: number;
};

function normalizeEventName(raw: string): HumanDeliverySocketEvent["event"] | null {
  switch (raw) {
    case "message_read":
    case "chat_seen":
      return "chat_seen";
    case "typing_start":
      return "typing_start";
    case "typing_stop":
      return "typing_stop";
    case "fragment_send":
    case "fragment_message":
      return "fragment_message";
    case "message_complete":
    case "delivery_completed":
      return "delivery_completed";
    case "delivery_cancelled":
      return "delivery_cancelled";
    default:
      return null;
  }
}

export class RealtimePlaybackManager {
  private channel: RealtimeChannel | null = null;
  private stopped = false;
  private lastSequenceId = -1;
  private lastFragmentByMessage = new Map<string, number>();
  private watchdogTimer: number | null = null;
  private opts: Required<Pick<RealtimePlaybackManagerOpts, "typingWatchdogMs">> & Omit<RealtimePlaybackManagerOpts, "typingWatchdogMs">;

  constructor(opts: RealtimePlaybackManagerOpts) {
    this.opts = { ...opts, typingWatchdogMs: opts.typingWatchdogMs ?? 14_000 };
  }

  start() {
    if (this.channel || this.stopped) return;
    const supabase = createOptionalSupabaseClient();
    if (!supabase) return;

    const suffix = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    })();
    const topic = `chat_delivery:${this.opts.sessionId}:${suffix}`;

    // Backend should broadcast on event name "human_delivery".
    this.channel = supabase
      .channel(topic)
      .on("broadcast", { event: "human_delivery" }, (payload) => {
        const data = (payload as any)?.payload as IncomingPayload | undefined;
        if (!data || typeof data !== "object") return;
        const sid = String(data.sessionId ?? data.session_id ?? "").trim();
        if (sid && sid !== this.opts.sessionId) {
          console.warn("[STALE_EVENT_DROPPED]", { reason: "session_mismatch", expected: this.opts.sessionId, got: sid });
          return;
        }
        const rawEvent = String(data.event ?? "").trim();
        const event = normalizeEventName(rawEvent);
        if (!event) return;

        const sequenceId = typeof data.sequence_id === "number" ? data.sequence_id : undefined;
        if (typeof sequenceId === "number") {
          if (sequenceId < this.lastSequenceId) {
            console.warn("[STALE_EVENT_DROPPED]", { reason: "sequence_id", last: this.lastSequenceId, got: sequenceId, rawEvent });
            return;
          }
          this.lastSequenceId = sequenceId;
        }

        const messageId = String(data.messageId ?? data.message_id ?? "").trim() || undefined;
        const fragmentIndex = typeof data.fragment_index === "number" ? data.fragment_index : undefined;
        if (event === "fragment_message" && messageId && typeof fragmentIndex === "number") {
          const last = this.lastFragmentByMessage.get(messageId) ?? -1;
          if (fragmentIndex <= last) {
            console.warn("[STALE_EVENT_DROPPED]", { reason: "fragment_index", messageId, last, got: fragmentIndex });
            return;
          }
          this.lastFragmentByMessage.set(messageId, fragmentIndex);
        }

        const ev: HumanDeliverySocketEvent & { sequenceId?: number; fragmentIndex?: number } = {
          event,
          sessionId: this.opts.sessionId,
          content: typeof data.content === "string" ? data.content : undefined,
          durationMs: typeof data.durationMs === "number" ? data.durationMs : typeof data.duration_ms === "number" ? data.duration_ms : undefined,
          delayMs: typeof data.delayMs === "number" ? data.delayMs : typeof data.delay_ms === "number" ? data.delay_ms : undefined,
          messageId,
          timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
          sequenceId,
          fragmentIndex,
        };

        console.log("[SOCKET_EVENT_RECEIVED]", { event: ev.event, sequenceId, fragmentIndex, delayMs: ev.delayMs });
        this.opts.onEvent(ev);

        // typing watchdog
        if (event === "typing_start") {
          this.armWatchdog();
        } else if (event === "typing_stop" || event === "delivery_completed" || event === "delivery_cancelled") {
          this.disarmWatchdog();
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") console.log("[REALTIME_SYNC_OK]", { topic });
      });
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.disarmWatchdog();
    const supabase = createOptionalSupabaseClient();
    if (supabase && this.channel) {
      void supabase.removeChannel(this.channel);
    }
    this.channel = null;
  }

  private armWatchdog() {
    this.disarmWatchdog();
    this.watchdogTimer = window.setTimeout(() => {
      console.warn("[PLAYBACK_RECOVERED]", { reason: "typing_watchdog" });
      this.opts.onEvent({ event: "typing_stop", sessionId: this.opts.sessionId });
    }, this.opts.typingWatchdogMs);
  }

  private disarmWatchdog() {
    if (this.watchdogTimer != null) window.clearTimeout(this.watchdogTimer);
    this.watchdogTimer = null;
  }
}

