"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Lock, MessageCircle } from "lucide-react";
import type { CommercialAgentPublic } from "@/lib/chat/commercial-agents";
import { PreChatFormSchema } from "@/lib/prospect/lead-profile/validation";
import {
  emptySmartProspectProfile,
  mergeSmartProspectProfile,
  normalizeContact,
} from "@/lib/prospect/lead-profile/prospect-profile";
import { scoreLeadTemperature } from "@/lib/prospect/lead-scoring/lead-temperature";
import { writePreChatProfile } from "@/lib/prospect/pre-chat/storage";

type PreChatExperienceProps = {
  slug: string;
  agentId: string;
  agentName: string;
  sessionId: string;
  lockedPersona?: CommercialAgentPublic | null;
  onComplete: () => void;
};

export function PreChatExperience({
  slug,
  agentId,
  agentName,
  sessionId,
  lockedPersona,
  onComplete,
}: PreChatExperienceProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [optionalMessage, setOptionalMessage] = useState("");
  const [city, setCity] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [budget, setBudget] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = lockedPersona?.avatar ?? "";
  const accent = lockedPersona?.accent ?? { from: "rgba(74,155,134,0.92)", to: "rgba(196,138,76,0.68)" };

  const formPayload = useMemo(
    () => ({
      name,
      contact,
      primaryNeed: optionalMessage,
      city: city || undefined,
      businessName: businessName || undefined,
      budget: budget || undefined,
    }),
    [name, contact, optionalMessage, city, businessName, budget],
  );

  const canSubmit = useMemo(() => PreChatFormSchema.safeParse(formPayload).success, [formPayload]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = PreChatFormSchema.safeParse(formPayload);
    if (!parsed.success) {
      setError("Merci d’indiquer votre prénom et un moyen de contact (téléphone ou e-mail).");
      return;
    }

    setSubmitting(true);
    const { email, phone } = normalizeContact(parsed.data.contact);
    const messageHint = String(parsed.data.primaryNeed ?? "").trim();
    const hasOptionalMessage = messageHint.length >= 2;

    const profile = mergeSmartProspectProfile(emptySmartProspectProfile(), {
      name: parsed.data.name,
      email,
      phone,
      city: parsed.data.city ?? null,
      businessName: parsed.data.businessName ?? null,
      primaryNeed: messageHint,
      budget: parsed.data.budget ?? null,
      language: "fr",
      interestLevel: hasOptionalMessage ? "warm" : "cold",
      leadTemperature: scoreLeadTemperature({
        buyingIntentScore: hasOptionalMessage ? 28 : 12,
        turnCount: 0,
        lastUserMessage: messageHint || undefined,
      }),
      lastInteraction: Date.now(),
    });

    writePreChatProfile(slug, profile);

    try {
      await fetch("/api/chat/prechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          session_id: sessionId,
          form: parsed.data,
          language: "fr",
        }),
      });
    } catch {
      // local profile still gates chat
    }

    setSubmitting(false);
    onComplete();
  }

  const inputClass =
    "w-full rounded-2xl border border-slate-900/[0.06] bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400/90 focus:border-[var(--agent-accent-from,rgba(74,155,134,0.45))] focus:ring-2 focus:ring-[var(--agent-accent-from,rgba(74,155,134,0.12))]";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-[100dvh] flex-col bg-[#e8eaed] text-slate-900"
      style={
        {
          ["--agent-accent-from" as string]: accent.from,
          ["--agent-accent-to" as string]: accent.to,
        } as React.CSSProperties
      }
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 85% 45% at 50% -5%, ${accent.from}18, transparent), radial-gradient(ellipse 55% 35% at 100% 100%, ${accent.to}14, transparent)`,
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col px-4 pb-10 pt-12 sm:pt-16">
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
          <div className="flex justify-center">
            <motion.div
              className="relative h-[72px] w-[72px] overflow-hidden rounded-[22px] shadow-md ring-[3px] ring-white"
              whileHover={{ scale: 1.02 }}
            >
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="grid h-full w-full place-items-center text-2xl font-semibold text-white"
                  style={{ background: `linear-gradient(145deg, ${accent.from}, ${accent.to})` }}
                >
                  {agentName.slice(0, 1)}
                </div>
              )}
            </motion.div>
          </div>
          <h1 className="mt-5 text-center text-[22px] font-semibold tracking-tight text-slate-900">
            {agentName}
          </h1>
          <p className="mt-2 text-center text-[15px] leading-snug text-slate-600">
            Dites bonjour — comme sur WhatsApp. Rien d’obligatoire à part votre prénom et un contact pour vous répondre.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex flex-1 flex-col gap-3.5 rounded-[20px] border border-white/90 bg-white/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        >
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-600">Prénom</span>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Comment vous appeler ?"
              autoComplete="given-name"
              maxLength={60}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-600">Téléphone ou e-mail</span>
            <input
              className={inputClass}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Pour vous recontacter si besoin"
              autoComplete="email tel"
              maxLength={120}
            />
          </label>

          <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-3">
            <label className="block">
              <span className="mb-0.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                <MessageCircle className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Optionnel
              </span>
              <span className="mb-2 block text-[12px] leading-relaxed text-slate-500">
                Que souhaitez-vous savoir ? Ou un petit message avant de commencer — seulement si vous en avez envie.
              </span>
              <textarea
                className={`${inputClass} min-h-[76px] resize-none border-slate-900/[0.05] bg-white`}
                value={optionalMessage}
                onChange={(e) => setOptionalMessage(e.target.value)}
                placeholder="Vous pouvez laisser vide et simplement discuter…"
                maxLength={280}
                rows={3}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 py-1 text-left text-[13px] font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${showMore ? "rotate-180" : ""}`} />
            Précisions facultatives
          </button>

          <AnimatePresence>
            {showMore ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col gap-3 overflow-hidden"
              >
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-600">Ville</span>
                  <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Douala" maxLength={80} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-600">Entreprise</span>
                  <input
                    className={inputClass}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Si c’est pour le pro"
                    maxLength={120}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-600">Budget indicatif</span>
                  <input
                    className={inputClass}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Uniquement si vous voulez"
                    maxLength={60}
                  />
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <motion.button
            type="submit"
            disabled={!canSubmit || submitting}
            whileTap={{ scale: 0.99 }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: canSubmit
                ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                : "linear-gradient(135deg, #94a3b8, #cbd5e1)",
            }}
          >
            {submitting ? "Ouverture…" : "Ouvrir la conversation"}
          </motion.button>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            <span className="inline-flex items-center justify-center gap-1">
              <Lock className="h-3 w-3 shrink-0 opacity-60" />
              Conversation privée — vos infos servent à vous répondre, pas à vous presser.
            </span>
          </p>
        </motion.form>
      </div>
    </motion.div>
  );
}
