"use client";

type SmartAutoScrollInput = {
  container: HTMLDivElement | null;
  thresholdPx?: number;
};

export function smartAutoScroll(input: SmartAutoScrollInput): boolean {
  const el = input.container;
  if (!el) return false;
  const threshold = input.thresholdPx ?? 88;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (distanceFromBottom <= threshold) {
    el.scrollTo({ top: Math.max(0, el.scrollHeight - el.clientHeight), behavior: "smooth" });
    console.log("[AUTO_SCROLL_TRIGGERED]", { distanceFromBottom });
    return true;
  }
  return false;
}
