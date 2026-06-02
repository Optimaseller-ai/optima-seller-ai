"use client";

import { useSyncExternalStore } from "react";

export type HumanDeliveryEventName =
  | "chat_seen"
  | "typing_start"
  | "typing_stop"
  | "fragment_message"
  | "delivery_cancelled"
  | "delivery_completed";

export type HumanDeliverySocketEvent = {
  event: HumanDeliveryEventName;
  sessionId?: string;
  content?: string;
  durationMs?: number;
  delayMs?: number;
  messageId?: string;
  timestamp?: number;
};

export type DeliveryPlaybackState = {
  isTyping: boolean;
  typingAgent: string | null;
  currentPlayback: "idle" | "running" | "paused" | "cancelled" | "completed";
  playbackQueue: HumanDeliverySocketEvent[];
  seenState: "offline" | "online" | "seen" | "typing";
  lastDeliveryEvent: HumanDeliverySocketEvent | null;
  timers: number;
};

type StoreShape = DeliveryPlaybackState & {
  setPatch: (patch: Partial<DeliveryPlaybackState>) => void;
  enqueue: (events: HumanDeliverySocketEvent[]) => void;
  shift: () => HumanDeliverySocketEvent | null;
  clearQueue: () => void;
};

const initialState: DeliveryPlaybackState = {
  isTyping: false,
  typingAgent: null,
  currentPlayback: "idle",
  playbackQueue: [],
  seenState: "online",
  lastDeliveryEvent: null,
  timers: 0,
};

let state: StoreShape = {
  ...initialState,
  setPatch(patch) {
    state = { ...state, ...patch };
    emit();
  },
  enqueue(events) {
    if (!events.length) return;
    state = { ...state, playbackQueue: [...state.playbackQueue, ...events] };
    emit();
  },
  shift() {
    if (!state.playbackQueue.length) return null;
    const [head, ...rest] = state.playbackQueue;
    state = { ...state, playbackQueue: rest };
    emit();
    return head ?? null;
  },
  clearQueue() {
    state = { ...state, playbackQueue: [] };
    emit();
  },
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useHumanDeliveryStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function humanDeliveryStoreActions() {
  return {
    setPatch: state.setPatch,
    enqueue: state.enqueue,
    shift: state.shift,
    clearQueue: state.clearQueue,
  };
}

export function rehydrateDeliveryState() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem("optima_human_delivery_state_v1");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<DeliveryPlaybackState> | null;
    if (!parsed || typeof parsed !== "object") return;
    state = {
      ...state,
      ...parsed,
      playbackQueue: Array.isArray(parsed.playbackQueue) ? parsed.playbackQueue : [],
    };
    emit();
  } catch {
    // ignore hydration failures
  }
}

export function persistDeliveryState() {
  if (typeof window === "undefined") return;
  try {
    const serializable: DeliveryPlaybackState = {
      isTyping: state.isTyping,
      typingAgent: state.typingAgent,
      currentPlayback: state.currentPlayback,
      playbackQueue: state.playbackQueue,
      seenState: state.seenState,
      lastDeliveryEvent: state.lastDeliveryEvent,
      timers: state.timers,
    };
    window.sessionStorage.setItem("optima_human_delivery_state_v1", JSON.stringify(serializable));
  } catch {
    // ignore persistence failures
  }
}
