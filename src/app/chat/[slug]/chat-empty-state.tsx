"use client";

import { motion } from "framer-motion";

type ChatEmptyStateProps = {
  darkMode: boolean;
  agentName: string;
  businessName: string;
  avatarUrl: string;
  avatarOk: boolean;
  /** true après effacement UI par l'utilisateur */
  clearedByUser: boolean;
  onStartNew: () => void;
  onSuggestion: (text: string) => void;
};

export function ChatEmptyState(props: ChatEmptyStateProps) {
  const suggestions = ["J'ai une question sur un produit", "Je cherche un prix", "Besoin d'un conseil"];

  return (
    <motion.div
      key={props.clearedByUser ? "cleared" : "welcome"}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl px-6 py-10 text-center ${
        props.darkMode ? "bg-white/[0.04] ring-1 ring-white/[0.06]" : "bg-white/60 ring-1 ring-slate-900/[0.04] shadow-sm"
      }`}
    >
      <div
        className={`mx-auto mb-5 h-16 w-16 overflow-hidden rounded-full ring-1 ${
          props.darkMode ? "ring-white/10" : "ring-black/[0.05]"
        }`}
      >
        {props.avatarOk ? <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
      </div>

      {props.clearedByUser ? (
        <>
          <p className={`text-[18px] font-semibold tracking-tight ${props.darkMode ? "text-slate-100" : "text-slate-900"}`}>
            Nouvelle conversation
          </p>
          <p className={`mx-auto mt-2 max-w-sm text-sm leading-relaxed ${props.darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Votre historique n&apos;est plus visible ici. {props.agentName} conserve le contexte utile pour mieux vous
            répondre.
          </p>
          <button
            type="button"
            onClick={props.onStartNew}
            className="mt-6 rounded-xl bg-[#347867] px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-[#2d6a5b]"
          >
            Recommencer
          </button>
        </>
      ) : (
        <>
          <p className={`text-[18px] font-semibold tracking-tight ${props.darkMode ? "text-slate-100" : "text-slate-900"}`}>
            Bienvenue chez {props.businessName}
          </p>
          <p className={`mx-auto mt-2 max-w-sm text-sm leading-relaxed ${props.darkMode ? "text-slate-300" : "text-slate-700"}`}>
            {props.agentName} vous répond en quelques minutes — ton proche du chat mobile.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => props.onSuggestion(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  props.darkMode
                    ? "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                    : "bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.08]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
