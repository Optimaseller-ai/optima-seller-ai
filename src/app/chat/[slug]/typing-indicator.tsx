"use client";

import { motion } from "framer-motion";

type TypingIndicatorProps = {
  name: string;
  avatarUrl: string;
  avatarOk: boolean;
  initials: string;
};

export function TypingIndicator({ name, avatarUrl, avatarOk, initials }: TypingIndicatorProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
      <div className="h-8 w-8 overflow-hidden rounded-full border border-white/80 bg-white/85">
        {avatarOk ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-slate-600">{initials}</div>}
      </div>
      <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 backdrop-blur-xl">
        <p className="mb-1 text-xs text-slate-500">{name} redige une reponse...</p>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, delay: d * 0.12 }}
              className="h-2 w-2 rounded-full bg-emerald-500/75"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
