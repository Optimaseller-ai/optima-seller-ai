"use client";

import { AnimatePresence, motion } from "framer-motion";

type ChatClearModalProps = {
  open: boolean;
  darkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ChatClearModal(props: ChatClearModalProps) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
            onClick={props.onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-chat-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed left-1/2 top-1/2 z-[90] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl ${
              props.darkMode ? "border-white/10 bg-[#151b24] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <h2 id="clear-chat-title" className="text-[17px] font-semibold tracking-tight">
              Effacer cette conversation ?
            </h2>
            <p className={`mt-3 text-[14px] leading-relaxed ${props.darkMode ? "text-slate-400" : "text-slate-600"}`}>
              Les messages seront supprimés de votre écran, mais l&apos;agent conservera certaines informations afin de
              mieux vous répondre.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onCancel}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium ${
                  props.darkMode ? "text-slate-300 hover:bg-white/5" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={props.onConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-rose-700"
              >
                Effacer
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
