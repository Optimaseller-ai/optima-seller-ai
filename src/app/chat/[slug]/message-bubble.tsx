"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";

type MessageBubbleProps = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  selected?: boolean;
  reactions?: Record<string, number>;
  showRead?: boolean;
  onSelect?: (id: string) => void;
  onSwipeReply?: (id: string) => void;
};

export function MessageBubble({ id, role, content, time, selected, reactions, showRead, onSelect, onSwipeReply }: MessageBubbleProps) {
  const isUser = role === "user";
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const firedRef = useRef(false);
  const threshold = 56;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    startRef.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dy) > 28) {
      setOffsetX(0);
      startRef.current = null;
      return;
    }
    const desired = isUser ? Math.min(0, dx) : Math.max(0, dx);
    const clamped = Math.max(-72, Math.min(72, desired));
    setOffsetX(clamped);
    if (!firedRef.current && Math.abs(clamped) >= threshold) {
      firedRef.current = true;
      onSwipeReply?.(id);
    }
  }

  function onPointerEnd() {
    startRef.current = null;
    setOffsetX(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, x: isUser ? 12 : -12, scale: 0.985, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: isUser ? 0.3 : 0.36, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <motion.div
        animate={{ x: offsetX }}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
        onClick={() => onSelect?.(id)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={[
          "max-w-[89%] rounded-[26px] px-4.5 py-3 text-[15px] leading-[1.62] tracking-[0.005em] shadow-[0_6px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 sm:max-w-[72%] sm:px-5 sm:py-3.5",
          selected ? "ring-2 ring-emerald-200/85" : "",
          isUser
            ? "rounded-br-[12px] border border-emerald-400/25 bg-[linear-gradient(135deg,#20ab74_0%,#189f6d_56%,#138a61_100%)] text-white"
            : "rounded-bl-[12px] border border-white/70 bg-white/76 text-slate-800 backdrop-blur-[10px]",
        ].join(" ")}
      >
        <p className={isUser ? "font-medium text-white/98" : "font-normal text-slate-700"}>{content}</p>
        <p className={`mt-1.5 text-right text-[10.5px] font-medium ${isUser ? "text-white/70" : "text-slate-400"}`}>
          {time}
          {showRead ? " · Vu" : ""}
        </p>
        {reactions && Object.keys(reactions).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(reactions).map(([emoji, n], i) => (
              <motion.span
                key={`${emoji}-${i}`}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
                className={`rounded-full px-2 py-0.5 text-[11px] ${isUser ? "bg-white/20 text-white" : "border border-slate-200 bg-white/90 text-slate-600"}`}
              >
                {emoji} {n}
              </motion.span>
            ))}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
