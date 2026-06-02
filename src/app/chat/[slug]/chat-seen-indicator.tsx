"use client";

import { motion } from "framer-motion";

type ChatSeenIndicatorProps = {
  state: "offline" | "online" | "seen" | "typing";
  darkMode: boolean;
};

const LABELS: Record<ChatSeenIndicatorProps["state"], string> = {
  offline: "Hors ligne",
  online: "En ligne",
  seen: "Vu",
  typing: "Ecrit...",
};

export function ChatSeenIndicator({ state, darkMode }: ChatSeenIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mx-auto my-2 w-fit rounded-full px-2 py-0.5 text-[11px] ${
        darkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-900/[0.05] text-slate-600"
      }`}
    >
      {LABELS[state]}
    </motion.div>
  );
}
