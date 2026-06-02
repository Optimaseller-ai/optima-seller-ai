"use client";

import {
  type HumanDeliverySocketEvent,
  humanDeliveryStoreActions,
  persistDeliveryState,
} from "./use-human-delivery-store";

type PlaybackCallbacks = {
  onTypingStart?: (event: HumanDeliverySocketEvent) => void;
  onTypingStop?: (event: HumanDeliverySocketEvent) => void;
  onSeen?: (event: HumanDeliverySocketEvent) => void;
  onFragment?: (event: HumanDeliverySocketEvent) => void;
  onCancelled?: (event: HumanDeliverySocketEvent) => void;
  onCompleted?: (event: HumanDeliverySocketEvent) => void;
};

type TimerRef = ReturnType<typeof window.setTimeout>;

export class HumanPlaybackScheduler {
  private queue: HumanDeliverySocketEvent[] = [];
  private paused = false;
  private cancelled = false;
  private running = false;
  private activeTimer: TimerRef | null = null;
  private timerRegistry = new Set<TimerRef>();
  private callbacks: PlaybackCallbacks;

  constructor(callbacks: PlaybackCallbacks) {
    this.callbacks = callbacks;
  }

  playDeliveryPlan(events: HumanDeliverySocketEvent[]) {
    if (!events.length) return;
    this.queue.push(...events);
    const actions = humanDeliveryStoreActions();
    actions.enqueue(events);
    actions.setPatch({ currentPlayback: "running" });
    persistDeliveryState();
    console.log("[PLAYBACK_STARTED]", { size: events.length });
    this.drain();
  }

  handleTypingStart(event: HumanDeliverySocketEvent) {
    const actions = humanDeliveryStoreActions();
    actions.setPatch({
      isTyping: true,
      seenState: "typing",
      lastDeliveryEvent: event,
    });
    persistDeliveryState();
    this.callbacks.onTypingStart?.(event);
    console.log("[TYPING_RENDERED]", event);
  }

  handleTypingStop(event: HumanDeliverySocketEvent) {
    const actions = humanDeliveryStoreActions();
    actions.setPatch({
      isTyping: false,
      seenState: "online",
      lastDeliveryEvent: event,
    });
    persistDeliveryState();
    this.callbacks.onTypingStop?.(event);
    console.log("[TYPING_CLEARED]", event);
  }

  handleSeenEvent(event: HumanDeliverySocketEvent) {
    const actions = humanDeliveryStoreActions();
    actions.setPatch({ seenState: "seen", lastDeliveryEvent: event });
    persistDeliveryState();
    this.callbacks.onSeen?.(event);
  }

  handleFragmentMessage(event: HumanDeliverySocketEvent) {
    if (!event.content?.trim()) return;
    const actions = humanDeliveryStoreActions();
    actions.setPatch({ lastDeliveryEvent: event });
    persistDeliveryState();
    this.callbacks.onFragment?.(event);
    console.log("[FRAGMENT_RENDERED]", { contentLen: event.content.length });
  }

  cancelPlayback(event?: HumanDeliverySocketEvent) {
    this.cancelled = true;
    this.running = false;
    this.queue = [];
    const actions = humanDeliveryStoreActions();
    actions.clearQueue();
    actions.setPatch({
      isTyping: false,
      currentPlayback: "cancelled",
      lastDeliveryEvent: event ?? null,
      timers: 0,
    });
    this.clearTimers();
    persistDeliveryState();
    this.callbacks.onCancelled?.(event ?? { event: "delivery_cancelled" });
    console.log("[PLAYBACK_CANCELLED]", event ?? null);
  }

  pausePlayback() {
    this.paused = true;
    humanDeliveryStoreActions().setPatch({ currentPlayback: "paused" });
    persistDeliveryState();
  }

  resumePlayback() {
    this.paused = false;
    this.cancelled = false;
    humanDeliveryStoreActions().setPatch({ currentPlayback: "running" });
    persistDeliveryState();
    this.drain();
  }

  receiveSocketEvent(event: HumanDeliverySocketEvent) {
    if (!event || typeof event !== "object") return;
    console.log("[SOCKET_EVENT_RECEIVED]", event);
    if (event.event === "delivery_cancelled") {
      this.cancelPlayback(event);
      return;
    }
    if (event.event === "delivery_completed") {
      this.queue.push(event);
      this.drain();
      return;
    }
    this.playDeliveryPlan([event]);
  }

  private drain() {
    if (this.running || this.paused || this.cancelled) return;
    this.running = true;
    const next = () => {
      if (this.paused || this.cancelled) {
        this.running = false;
        return;
      }
      const event = this.queue.shift();
      humanDeliveryStoreActions().shift();
      if (!event) {
        this.running = false;
        humanDeliveryStoreActions().setPatch({ currentPlayback: "completed", timers: this.timerRegistry.size });
        persistDeliveryState();
        console.log("[PLAYBACK_COMPLETED]");
        return;
      }
      const delay = Math.max(0, Number(event.delayMs ?? 0));
      const timer = window.setTimeout(() => {
        this.timerRegistry.delete(timer);
        humanDeliveryStoreActions().setPatch({ timers: this.timerRegistry.size });
        this.execute(event);
        next();
      }, delay);
      this.activeTimer = timer;
      this.timerRegistry.add(timer);
      humanDeliveryStoreActions().setPatch({ timers: this.timerRegistry.size });
    };
    next();
  }

  private execute(event: HumanDeliverySocketEvent) {
    const actions = humanDeliveryStoreActions();
    actions.setPatch({ lastDeliveryEvent: event });
    switch (event.event) {
      case "chat_seen":
        this.handleSeenEvent(event);
        break;
      case "typing_start":
        this.handleTypingStart(event);
        break;
      case "typing_stop":
        this.handleTypingStop(event);
        break;
      case "fragment_message":
        this.handleFragmentMessage(event);
        break;
      case "delivery_cancelled":
        this.cancelPlayback(event);
        break;
      case "delivery_completed":
        actions.setPatch({ currentPlayback: "completed" });
        this.callbacks.onCompleted?.(event);
        console.log("[PLAYBACK_COMPLETED]", event);
        break;
      default:
        break;
    }
    persistDeliveryState();
  }

  private clearTimers() {
    for (const t of this.timerRegistry) window.clearTimeout(t);
    this.timerRegistry.clear();
    this.activeTimer = null;
  }
}
