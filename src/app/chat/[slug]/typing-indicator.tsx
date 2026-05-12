"use client";

import { motion } from "framer-motion";

export type TypingIndicatorPhase = "thinking" | "writing";

type TypingIndicatorProps = {
  name: string;
  avatarUrl: string;
  avatarOk: boolean;
  initials: string;
  phase?: TypingIndicatorPhase;
  subtitle?: string;
  darkMode?: boolean;
};

export function TypingIndicator({ subtitle, avatarUrl, avatarOk, initials, phase = "writing", darkMode = false }: TypingIndicatorProps) {
  const fallbackSubtitle = phase === "thinking" ? "Consultation en cours" : "Réponse en préparation";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="flex items-end gap-2"
    >
      <div
        className={`h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ${
          darkMode ? "ring-white/[0.07]" : "ring-black/[0.04]"
        }`}
      >
        {avatarOk ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`grid h-full w-full place-items-center text-[9px] font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{initials}</div>
        )}
      </div>
      <div
        className={`rounded-xl px-2.5 py-1.5 ring-1 ${
          darkMode ? "bg-white/[0.06] text-slate-100 ring-white/[0.06]" : "bg-white/80 text-slate-800 ring-slate-900/[0.04] backdrop-blur-[2px]"
        }`}
      >
        <p className={`mb-1 text-[11px] leading-tight ${darkMode ? "text-slate-500" : "text-slate-500"}`}>{subtitle || fallbackSubtitle}</p>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ y: [0, -3, 0], opacity: [0.35, 0.85, 0.35] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: phase === "thinking" ? 1.55 : 1.2, delay: d * 0.14, ease: "easeInOut" }}
              className={`h-1.5 w-1.5 rounded-full ${darkMode ? "bg-slate-500/75" : "bg-slate-400/65"}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
