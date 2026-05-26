"use client";

import { VoiceNotePlayer } from "@/components/chat/voice-note-player";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { memo } from "react";

type MessageBubbleProps = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "text" | "image" | "audio";
  audioUrl?: string;
  audioDurationMs?: number;
  audioTranscript?: string;
  time: string;
  selected?: boolean;
  reactions?: Record<string, number>;
  showRead?: boolean;
  footerStatus?: string;
  groupPosition?: "single" | "start" | "middle" | "end";
  readAtLabel?: string;
  showAvatar?: boolean;
  avatarUrl?: string;
  avatarOk?: boolean;
  initials?: string;
  darkMode?: boolean;
  onSelect?: (id: string) => void;
  onSwipeReply?: (id: string) => void;
};

function MessageBubbleComponent({
  id,
  role,
  content,
  kind = "text",
  audioUrl,
  audioDurationMs,
  audioTranscript,
  time,
  selected,
  reactions,
  showRead,
  footerStatus,
  groupPosition = "single",
  readAtLabel,
  showAvatar = true,
  avatarUrl,
  avatarOk = true,
  initials = "SC",
  darkMode = false,
  onSelect,
  onSwipeReply,
}: MessageBubbleProps) {
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

  const bubbleSurface = isUser
    ? darkMode
      ? "bg-gradient-to-br from-[#2a3833] to-[#1f2a26] text-slate-100 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
      : "bg-gradient-to-br from-[#edf3ef] to-[#e4ebe6] text-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]"
    : darkMode
      ? "bg-[#222925]/95 text-slate-100 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]"
      : "bg-white/96 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  const timeClass = isUser
    ? darkMode
      ? "text-slate-400"
      : "text-slate-600"
    : darkMode
      ? "text-slate-400"
      : "text-slate-600";

  const textClass = isUser
    ? darkMode
      ? "font-normal text-slate-100"
      : "font-normal text-slate-800"
    : darkMode
      ? "font-normal text-slate-100"
      : "font-normal text-slate-800";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, x: isUser ? 8 : -8, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.85 }}
      className={`flex w-full items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser ? (
        showAvatar ? (
          <div
            className={`h-7 w-7 shrink-0 overflow-hidden rounded-full shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ${
              darkMode ? "ring-white/10" : "ring-black/[0.05]"
            }`}
          >
            {avatarOk && avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[9px] font-semibold text-slate-500">{initials}</div>
            )}
          </div>
        ) : (
          <div className="h-7 w-7 shrink-0" />
        )
      ) : null}
      <motion.div
        layout="position"
        animate={{ x: offsetX }}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
        whileTap={{ scale: 0.99 }}
        whileHover={{ y: -0.5 }}
        onClick={() => onSelect?.(id)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={[
          `w-fit max-w-[min(92%,640px)] rounded-xl px-3 text-[13px] transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[min(88%,720px)] ${isUser ? "py-1.5 leading-[1.45]" : "py-1 leading-[1.4]"}`,
          groupPosition === "start" ? (isUser ? "rounded-br-[6px]" : "rounded-bl-[6px]") : "",
          groupPosition === "middle" ? (isUser ? "rounded-r-[6px] rounded-l-2xl" : "rounded-l-[6px] rounded-r-2xl") : "",
          groupPosition === "end" ? (isUser ? "rounded-tr-[10px]" : "rounded-tl-[10px]") : "",
          isUser ? `rounded-br-[8px] ${bubbleSurface}` : `rounded-bl-[8px] ${bubbleSurface}`,
          selected ? (darkMode ? "shadow-[0_0_0_2px_rgba(120,170,150,0.22)]" : "shadow-[0_0_0_2px_rgba(61,107,92,0.2)]") : "",
        ].join(" ")}
      >
        {kind === "audio" && audioUrl ? (
          <VoiceNotePlayer
            src={audioUrl}
            durationMs={audioDurationMs}
            darkMode={darkMode}
            isUser={isUser}
            transcript={audioTranscript}
          />
        ) : (
          <p className={textClass}>{content}</p>
        )}
        <p className={`${isUser ? "mt-0.5" : "mt-0"} text-right text-[10px] font-medium tracking-wide opacity-90 ${timeClass}`}>
          {time}
          {showRead ? " · Lu" : ""}
          {readAtLabel ? ` · ${readAtLabel}` : ""}
          {footerStatus ? ` · ${footerStatus}` : ""}
        </p>
        {reactions && Object.keys(reactions).length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([emoji, n], i) => (
              <motion.span
                key={`${emoji}-${i}`}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                  isUser
                    ? darkMode
                      ? "bg-white/10 text-slate-200"
                      : "bg-[rgba(61,107,92,0.12)] text-slate-700"
                    : darkMode
                      ? "bg-white/10 text-slate-300"
                      : "bg-slate-900/[0.04] text-slate-600"
                }`}
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

export const MessageBubble = memo(MessageBubbleComponent);
