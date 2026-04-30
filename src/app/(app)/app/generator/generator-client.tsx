"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Crown,
  MessageCircleMore,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { generateMessages, refineMessage } from "@/app/(app)/app/generator/actions";
import { cn } from "@/lib/utils";

type Tone = "pro" | "friendly" | "direct" | "luxury";
type Mode = "reply" | "followup" | "closing" | "complaint" | "promo";
type Length = "short" | "medium" | "long";
type Formality = "formal" | "casual";

export function GeneratorClient() {
  const search = useSearchParams();
  const initialMode = (search.get("tab") ?? "reply") as Mode;

  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [tone, setTone] = React.useState<Tone>("pro");
  const [length, setLength] = React.useState<Length>("medium");
  const [formality, setFormality] = React.useState<Formality>("formal");
  const [userTimezone] = React.useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Douala";
    } catch {
      return "Africa/Douala";
    }
  });
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [capabilities, setCapabilities] = React.useState<
    null | { realtime: boolean; webSearch: boolean; businessMemory: boolean }
  >(null);

  const [input, setInput] = React.useState("");

  const [results, setResults] = React.useState<string[]>([]);
  const [refiningIdx, setRefiningIdx] = React.useState<number | null>(null);

  async function run(nextMode: Mode = mode) {
    if (!input.trim()) {
      toast({ title: "Ajoutez un texte", description: "Remplissez le champ avant de generer." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await generateMessages({
          mode: nextMode,
          input,
          tone,
          length,
          formality,
          userTimezone,
        });
        setResults(res.items);
        setCapabilities(res.capabilities ?? null);
      } catch (err: unknown) {
        toast({
          title: "Erreur",
          description: getErrorMessage(err) ?? "Impossible de generer.",
          variant: "destructive",
        });
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copie", description: "Message copie dans le presse-papiers." });
    } catch {
      toast({ title: "Copie impossible", description: "Copiez manuellement.", variant: "destructive" });
    }
  }

  async function refine(idx: number, instruction: "more_selling" | "shorter") {
    const current = results[idx];
    if (!current) return;

    setRefiningIdx(idx);
    try {
      const res = await refineMessage({ instruction, text: current, tone, formality, userTimezone });
      setResults((prev) => prev.map((p, i) => (i === idx ? res.item : p)));
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err) ?? "Impossible d'ameliorer le message.",
        variant: "destructive",
      });
    } finally {
      setRefiningIdx(null);
    }
  }

  async function regenerateOne(idx: number) {
    if (!input.trim()) return;
    setRefiningIdx(idx);
    try {
      const res = await generateMessages({ mode, input, tone, length, formality, userTimezone });
      const next = res.items[idx] ?? res.items[0];
      if (!next) return;
      setResults((prev) => prev.map((p, i) => (i === idx ? next : p)));
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err) ?? "Impossible de regenerer.",
        variant: "destructive",
      });
    } finally {
      setRefiningIdx(null);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* TOP HEADER */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/75 shadow-sm">
          <Sparkles className="size-3.5 text-[var(--brand-gold)]" />
          1 clic = 3 réponses professionnelles
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
              Générateur IA WhatsApp
            </h1>
            <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
              Créez des réponses qui rassurent, relancent et concluent des ventes.
            </p>
            {capabilities?.realtime ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.08)] px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/75">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" />
                Temps réel activé
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT = CONTROLS */}
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-base text-[var(--brand-navy)]">Contrôles</CardTitle>
            <CardDescription>Choisissez le mode et le style de vos réponses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-3 sm:p-6">
            <div className="space-y-2">
              <Label className="text-[var(--brand-navy)]">Mode</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map((m) => (
                  <ModeCard
                    key={m.id}
                    active={mode === m.id}
                    title={m.label}
                    description={m.description}
                    icon={m.icon}
                    onClick={() => {
                      setMode(m.id);
                      setResults([]);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--brand-navy)]">Ton</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={cn(
                      "h-11 rounded-[var(--radius)] border bg-white px-3 text-left text-[15px] font-medium text-[var(--brand-navy)] transition sm:text-sm",
                      tone === t.id
                        ? "border-[var(--brand-green)]/30 ring-2 ring-[rgba(22,163,74,0.16)]"
                        : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[var(--brand-navy)]">Longueur</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLength(l.id)}
                      className={cn(
                        "h-11 rounded-[var(--radius)] border bg-white px-3 text-sm font-medium text-[var(--brand-navy)] transition",
                        length === l.id
                          ? "border-[var(--brand-green)]/30 ring-2 ring-[rgba(22,163,74,0.16)]"
                          : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--brand-navy)]">Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMALITIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormality(f.id)}
                      className={cn(
                        "h-11 rounded-[var(--radius)] border bg-white px-3 text-sm font-medium text-[var(--brand-navy)] transition",
                        formality === f.id
                          ? "border-[var(--brand-green)]/30 ring-2 ring-[rgba(22,163,74,0.16)]"
                          : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT = INPUT */}
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-base text-[var(--brand-navy)]">Votre message</CardTitle>
            <CardDescription>Collez le contexte WhatsApp tel quel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-6">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: Bonsoir, c'est combien ? Livraison à Yaoundé ?"
              className="min-h-44 text-[15px] leading-relaxed sm:min-h-56 sm:text-sm"
            />
            <div className="text-xs text-[var(--brand-navy)]/55">
              Soyez précis pour de meilleures réponses.
            </div>

            <Button
              size="lg"
              className="h-12 w-full bg-[var(--brand-green)] text-white shadow-[0_14px_40px_rgba(22,163,74,0.18)] hover:bg-[var(--brand-green)]/90"
              onClick={() => run()}
              disabled={pending}
            >
              {pending ? "Génération…" : "Générer 3 réponses prêtes à envoyer"}
            </Button>

            {pending ? <LoadingShimmer /> : null}
          </CardContent>
        </Card>
      </div>

      {/* RESULTS */}
      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-base text-[var(--brand-navy)]">Résultats</CardTitle>
          <CardDescription>3 options prêtes à copier-coller dans WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-6">
          {results.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4 text-sm text-[var(--brand-navy)]/60">
              Aucun résultat pour l’instant. Lancez une génération.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {results.slice(0, 3).map((r, idx) => (
                <ResultCard
                  key={idx}
                  text={r}
                  busy={pending || refiningIdx === idx}
                  onCopy={() => copy(r)}
                  onRegenerate={() => regenerateOne(idx)}
                  onMoreSelling={() => refine(idx, "more_selling")}
                  onShorter={() => refine(idx, "shorter")}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TONES: { id: Tone; label: string }[] = [
  { id: "pro", label: "Pro" },
  { id: "friendly", label: "Chaleureux" },
  { id: "direct", label: "Direct" },
  { id: "luxury", label: "Premium" },
];

const MODES: {
  id: Mode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "reply",
    label: "Répondre client",
    description: "Réponse pro + question de qualification.",
    icon: MessageCircleMore,
  },
  {
    id: "followup",
    label: "Relancer prospect",
    description: "Relance courte, persuasive, sans pression.",
    icon: Timer,
  },
  {
    id: "closing",
    label: "Conclure vente",
    description: "Traitez les objections et closez proprement.",
    icon: Zap,
  },
  {
    id: "complaint",
    label: "Gérer plainte",
    description: "Empathie + solution + réassurance.",
    icon: ShieldCheck,
  },
  {
    id: "promo",
    label: "Promo WhatsApp",
    description: "Message promo clair avec CTA.",
    icon: Megaphone,
  },
] as const;

const LENGTHS: { id: Length; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const FORMALITIES: { id: Formality; label: string }[] = [
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
];

function ModeCard({
  active,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius)] border bg-white p-4 text-left shadow-sm transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(15,23,42,0.10)] motion-reduce:hover:translate-y-0",
        active
          ? "border-[var(--brand-green)]/25 ring-2 ring-[rgba(22,163,74,0.16)]"
          : "border-[var(--brand-navy)]/10",
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [background:radial-gradient(36rem_20rem_at_10%_0%,rgba(22,163,74,0.12),transparent_55%),radial-gradient(34rem_20rem_at_100%_70%,rgba(245,158,11,0.10),transparent_55%)]" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-white shadow-sm">
          <Icon className={cn("size-5", active ? "text-[var(--brand-green)]" : "text-[var(--brand-navy)]")} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--brand-navy)]">{title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-[var(--brand-navy)]/60">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function ResultCard({
  text,
  busy,
  onCopy,
  onRegenerate,
  onMoreSelling,
  onShorter,
}: {
  text: string;
  busy: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onMoreSelling: () => void;
  onShorter: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-navy)]/70">
          <Crown className="size-3.5 text-[var(--brand-gold)]" />
          Réponse
        </div>
        <Button variant="secondary" size="icon" onClick={onCopy} aria-label="Copier">
          <Copy className="size-4" />
        </Button>
      </div>

      <div className={cn("text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--brand-navy)] sm:text-sm", busy ? "opacity-60" : undefined)}>
        {text}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" className="bg-white" onClick={onRegenerate} disabled={busy}>
          Régénérer
        </Button>
        <Button variant="outline" className="bg-white" onClick={onMoreSelling} disabled={busy}>
          Plus vendeur
        </Button>
        <Button variant="outline" className="bg-white" onClick={onShorter} disabled={busy}>
          Plus court
        </Button>
        <Button asChild className="bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green)]/90" disabled={busy}>
          <Link href="/pricing">Upgrade</Link>
        </Button>
      </div>

      {busy ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-white/35" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]" />
        </div>
      ) : null}
    </div>
  );
}

function LoadingShimmer() {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4">
      <div className="flex items-center justify-between">
        <div className="h-3 w-40 rounded bg-[var(--brand-navy)]/10" />
        <div className="h-8 w-8 rounded bg-[var(--brand-navy)]/10" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-[var(--brand-navy)]/10" />
        <div className="h-3 w-11/12 rounded bg-[var(--brand-navy)]/10" />
        <div className="h-3 w-10/12 rounded bg-[var(--brand-navy)]/10" />
      </div>
      <div className="mt-4 h-10 w-full rounded bg-[var(--brand-navy)]/10" />
    </div>
  );
}

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}
