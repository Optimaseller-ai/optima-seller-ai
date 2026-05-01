"use client";

import * as React from "react";
import { ArrowRight, Copy, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { getDefaultWhatsAppProvider } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type FollowupDraft = {
  id: string;
  createdAt: string;
  incoming: string;
  reply: string;
};

const STORAGE_KEY = "optima:auto_reply:followups";

function saveFollowup(draft: FollowupDraft) {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const list = raw ? (JSON.parse(raw) as FollowupDraft[]) : [];
  list.unshift(draft);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}

export function AutoReplyClient() {
  const { toast } = useToast();
  const provider = getDefaultWhatsAppProvider();

  const [incoming, setIncoming] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingSellier, setLoadingSellier] = React.useState(false);

  async function generate(mode: "reply" | "closing", message: string) {
    const res = await fetch("/api/ai/chat-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        message,
        history: [],
        responseFormat: "single",
      }),
    });
    const json = (await res.json()) as { message?: string; error?: string };
    if (!res.ok) throw new Error(json.error ?? "Erreur IA");
    if (!json.message) throw new Error("Réponse IA vide");
    return json.message;
  }

  async function onGenerate() {
    if (!incoming.trim()) return;
    try {
      setLoading(true);
      const msg = [
        "Tu réponds comme un vendeur WhatsApp professionnel.",
        "Objectif: répondre vite, rassurer, et avancer vers l’achat (1 question max à la fin).",
        "",
        `Message du client:\n${incoming.trim()}`,
      ].join("\n");
      const out = await generate("reply", msg);
      setReply(out.trim());
    } catch (err) {
      toast({
        title: "Auto Reply",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSellier() {
    if (!incoming.trim()) return;
    try {
      setLoadingSellier(true);
      const msg = [
        "Réécris une version plus vendeuse et plus convaincante.",
        "Garde un ton naturel WhatsApp. Pas trop long. Ajoute une preuve/garantie si utile.",
        "Termine par une question simple pour faire répondre le client.",
        "",
        `Message du client:\n${incoming.trim()}`,
        "",
        reply.trim() ? `Réponse actuelle:\n${reply.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const out = await generate("closing", msg);
      setReply(out.trim());
    } catch (err) {
      toast({
        title: "Version plus vendeuse",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoadingSellier(false);
    }
  }

  async function copy() {
    if (!reply.trim()) return;
    try {
      await navigator.clipboard.writeText(reply.trim());
      toast({ title: "Copié", description: "Réponse copiée dans le presse‑papier." });
    } catch {
      toast({ title: "Copie impossible", description: "Autorisez l’accès au presse‑papier.", variant: "destructive" });
    }
  }

  function sendWhatsApp() {
    if (!reply.trim()) return;
    const url = provider.buildSendUrl({ text: reply.trim(), phoneE164: null });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function remindLater() {
    if (!incoming.trim() || !reply.trim()) return;
    const id = `f_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    saveFollowup({ id, createdAt: new Date().toISOString(), incoming: incoming.trim(), reply: reply.trim() });
    toast({ title: "Relance enregistrée", description: "Sauvegardée dans ce navigateur (Phase 1)." });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="text-sm font-medium text-[var(--brand-navy)]">Message client</div>
        <Textarea
          value={incoming}
          onChange={(e) => setIncoming(e.target.value)}
          placeholder="Collez le message reçu sur WhatsApp…"
          className="min-h-[120px] border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]"
        />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Button
            size="lg"
            className={cn("h-11", loading ? "pointer-events-none opacity-80" : undefined)}
            onClick={() => void onGenerate()}
            disabled={loading || !incoming.trim()}
          >
            {loading ? "Génération…" : "Générer une réponse"}
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <div className="text-xs text-[var(--brand-navy)]/55">
            Conseil: collez le message complet (prix, ville, questions).
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium text-[var(--brand-navy)]">Réponse Optima</div>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Votre réponse apparaîtra ici…"
          className="min-h-[140px] border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]"
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" className="h-11" onClick={sendWhatsApp} disabled={!reply.trim()}>
            Envoyer sur WhatsApp
          </Button>
          <Button size="lg" variant="outline" className="h-11 bg-white" onClick={() => void copy()} disabled={!reply.trim()}>
            <Copy className="mr-2 size-4" />
            Copier
          </Button>
          <Button size="lg" variant="outline" className="h-11 bg-white" onClick={remindLater} disabled={!reply.trim() || !incoming.trim()}>
            <Timer className="mr-2 size-4" />
            Relancer plus tard
          </Button>
          <Button
            size="lg"
            variant="gold"
            className={cn("h-11", loadingSellier ? "pointer-events-none opacity-80" : undefined)}
            onClick={() => void onSellier()}
            disabled={loadingSellier || !incoming.trim()}
          >
            <Sparkles className="mr-2 size-4" />
            Version plus vendeuse
          </Button>
        </div>

        <div className="text-xs text-[var(--brand-navy)]/55">
          Phase 2: réponses automatiques, relances différées, tagging prospects, horaires, reprise humaine.
        </div>
      </div>
    </div>
  );
}

