"use client";

import { motion } from "framer-motion";

type TypingBubbleProps = {
  darkMode: boolean;
};

export function TypingBubble({ darkMode }: TypingBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className={`w-fit rounded-2xl px-3 py-2 ring-1 ${
        darkMode ? "bg-[#1f2826] text-slate-200 ring-white/10" : "bg-white text-slate-700 ring-slate-900/[0.06]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${darkMode ? "bg-slate-400/80" : "bg-slate-400/70"}`}
            animate={{ y: [0, -2.5, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}
