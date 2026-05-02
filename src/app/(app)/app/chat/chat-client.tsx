"use client";

import * as React from "react";
import { Send, RefreshCcw } from "lucide-react";
import {
  Bot,
  Brain,
  Crown,
  Globe,
  Sparkles,
  Timer,
  TrendingUp,
  MessageCircleMore,
  ShieldCheck,
  Megaphone,
  Zap,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { useQuota } from "@/lib/data/use-quota";
import { MemoryBanner } from "@/components/app/memory-banner";
import { computeMemoryStatus } from "@/lib/data/business-memory";

type Model =
  | "openai/gpt-4o-mini"
  | "anthropic/claude-3.5-sonnet"
  | "deepseek/deepseek-chat-v3"
  | "perplexity/sonar";
type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string; ts: number };

type Mode = "reply" | "followup" | "closing" | "complaint" | "promo";

const MODELS: {
  id: Model;
  label: string;
  subtitle: string;
  badges: { label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    subtitle: "Rapide et fiable pour vos réponses quotidiennes.",
    badges: [
      { label: "Rapide", icon: Timer },
      { label: "Closing", icon: TrendingUp },
    ],
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    subtitle: "Très bon style, nuance et persuasion.",
    badges: [
      { label: "CRéatif", icon: Sparkles },
      { label: "Closing", icon: TrendingUp },
    ],
  },
  {
    id: "deepseek/deepseek-chat-v3",
    label: "DeepSeek Chat",
    subtitle: "Excellent rapport qualité/prix pour volume.",
    badges: [
      { label: "Rapide", icon: Timer },
      { label: "Business", icon: Brain },
    ],
  },
  {
    id: "perplexity/sonar",
    label: "Perplexity Sonar",
    subtitle: "Idéal si vous avez besoin de recherche web.",
    badges: [
      { label: "Recherche web", icon: Globe },
      { label: "Confiance", icon: Crown },
    ],
  },
] as const;

const MODES: {
  id: Mode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "reply", label: "Répondre client", icon: MessageCircleMore },
  { id: "followup", label: "Relancer prospect", icon: Timer },
  { id: "closing", label: "Conclure vente", icon: Zap },
  { id: "complaint", label: "Gérer plainte", icon: ShieldCheck },
  { id: "promo", label: "Promo WhatsApp", icon: Megaphone },
] as const;

type Capabilities = { realtime: boolean; webSearch: boolean; businessMemory: boolean };

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function postChatWithRetries(payload: {
  message: string;
  history: { role: "user" | "assistant"; content: string; ts?: string }[];
  model: Model;
  mode: Mode;
  userTimezone?: string;
  responseFormat: "single" | "items_3";
}) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("/api/ai/chat-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as unknown;
      const errMsg =
        typeof (data as { error?: unknown } | null)?.error === "string"
          ? (data as { error: string }).error
          : undefined;
      if (!resp.ok) {
        throw new Error(errMsg ?? `HTTP ${resp.status}`);
      }
      if (payload.responseFormat === "items_3") {
        if (!Array.isArray((data as { items?: unknown } | null)?.items)) {
          throw new Error("Invalid server response.");
        }
        return data as { items: string[]; model?: string; id?: string | null; capabilities?: Capabilities };
      }

      if (typeof (data as { message?: unknown } | null)?.message !== "string") throw new Error("Invalid server response.");
      return data as { message: string; model?: string; id?: string | null; capabilities?: Capabilities };
    } catch (err) {
      lastErr = err;
      await sleep(350 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

export function ChatClient() {
  const { toast } = useToast();
  const profile = useProfile();
  const quota = useQuota();
  const mem = computeMemoryStatus(profile.profile);

  const [model, setModel] = React.useState<Model>("openai/gpt-4o-mini");
  const [mode, setMode] = React.useState<Mode>("reply");
  const isPro = quota.plan === "pro";
  const [responseFormat, setResponseFormat] = React.useState<"single" | "items_3">("single");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [capabilities, setCapabilities] = React.useState<Capabilities | null>(null);
  const [lastUserInput, setLastUserInput] = React.useState<string | null>(null);
  const [userTimezone] = React.useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Douala";
    } catch {
      return "Africa/Douala";
    }
  });

  const historyForApi = React.useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => {
          if (isPro) return true;
          return Date.now() - m.ts <= 3 * 24 * 60 * 60 * 1000;
        })
        .map((m) => ({ role: m.role, content: m.content, ts: new Date(m.ts).toISOString() })),
    [isPro, messages],
  );

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  async function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    if (pending) return;
    if (!quota.loading && quota.exhausted) {
      toast({
        title: "Quota atteint",
        description: "Vous avez atteint votre quota mensuel. Disponible bientôt : upgrade Pro.",
        variant: "destructive",
      });
      return;
    }

    setPending(true);
    setLastUserInput(trimmed);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await postChatWithRetries({
        message: trimmed,
        history: historyForApi,
        model,
        mode,
        userTimezone,
        responseFormat: isPro ? responseFormat : "single",
      });
      if ((res as any).capabilities) setCapabilities((res as any).capabilities);

      if (isPro && responseFormat === "items_3" && Array.isArray((res as any).items)) {
        const items = (res as any).items as string[];
        const text = items.map((s, i) => `Option ${i + 1}:\n${s}`).join("\n\n");
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", ts: Date.now(), content: text },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", ts: Date.now(), content: (res as any).message },
        ]);
      }
    } catch (err: unknown) {
      toast({
        title: "Erreur IA",
        description: err instanceof Error ? err.message : "Impossible d'obtenir une Réponse.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setPending(false);
    }
  }

  async function retryLast() {
    if (!lastUserInput) return;
    await send(lastUserInput);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <MemoryBanner />
      {/* TOP HEADER */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/75 shadow-sm">
          <Sparkles className="size-3.5 text-[var(--brand-gold)]" />
          Mémoire business active
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
            Assistant IA Business
          </h1>
          <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
            réponses clients, ventes, relances et support en temps Réel.
          </p>
          {capabilities?.realtime ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.08)] px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/75">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" />
              Temps Réel activé
            </div>
          ) : null}
        </div>
      </div>

      {/* LAYOUT */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* MODEL SELECTOR */}
          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--brand-navy)]">Modèle</CardTitle>
              <CardDescription>Choisissez le moteur le plus adapté à votre situation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
              {MODELS.map((m) => (
                <ModelCard
                  key={m.id}
                  active={model === m.id}
                  locked={!isPro && m.id !== "openai/gpt-4o-mini"}
                  title={m.label}
                  subtitle={m.subtitle}
                  badges={m.badges}
                  onClick={() => {
                    if (!isPro && m.id !== "openai/gpt-4o-mini") {
                      toast({
                        title: "Disponible en version Pro",
                        description: "Débloquez plusieurs moteurs IA + réponses premium. Ouvrez Tarifs pour upgrader.",
                      });
                      return;
                    }
                    setModel(m.id);
                  }}
                />
              ))}
            </CardContent>
          </Card>

          {/* CHAT */}
          <div className="relative overflow-hidden rounded-3xl bg-[hsl(var(--background))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.55] [background:radial-gradient(36rem_22rem_at_20%_0%,rgba(22,163,74,0.10),transparent_60%),radial-gradient(32rem_20rem_at_90%_20%,rgba(245,158,11,0.10),transparent_55%)]" />
            <div className="p-0">
              <div className="relative">
                <div
                  ref={scrollRef}
                  className="relative h-[calc(100svh-260px)] space-y-4 overflow-auto px-4 py-5 sm:h-[480px] sm:px-6 sm:py-6"
                >
                  {messages.length === 0 ? (
                    <div className="grid h-full place-items-center">
                      <div className="w-full max-w-md rounded-3xl border border-[var(--brand-navy)]/10 bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-[rgba(22,163,74,0.10)] text-[var(--brand-green)] shadow-[0_12px_35px_rgba(22,163,74,0.12)]">
                          <Sparkles className="size-5" />
                        </div>
                        <div className="mt-3 text-base font-semibold text-[var(--brand-navy)]">Bonjour 👋</div>
                        <div className="mt-1 text-sm text-[var(--brand-navy)]/65">
                          Je connais votre business. Envoyez un message client pour obtenir une réponse qui convertit.
                        </div>
                        <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-navy)]/60">
                          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--brand-green)]" />
                          Prêt à rédiger
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {messages.map((m) => (
                    <ChatBubble key={m.id} role={m.role}>
                      {m.content}
                    </ChatBubble>
                  ))}

              {pending ? (
                <ChatBubble role="assistant">
                  <TypingDots />
                </ChatBubble>
              ) : null}
            </div>

                {/* sticky input */}
                <div className="sticky bottom-0 border-t border-[var(--brand-navy)]/5 bg-white/70 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/55 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    {MODES.map((m) => {
                      const active = m.id === mode;
                      const Icon = m.icon;
                      const locked = !isPro && m.id !== "reply" && m.id !== "promo";
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (locked) return;
                            setMode(m.id);
                          }}
                          disabled={locked}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
                            active
                              ? "border-[var(--brand-green)]/25 bg-[rgba(22,163,74,0.08)] text-[var(--brand-navy)] ring-2 ring-[rgba(22,163,74,0.16)]"
                              : locked
                                ? "cursor-not-allowed border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]/35 opacity-80"
                                : "border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]/70 hover:bg-[hsl(var(--background))]",
                          )}
                          title={locked ? "Disponible sur le plan Pro" : undefined}
                        >
                          <Icon className={cn("size-3.5", active ? "text-[var(--brand-green)]" : "text-[var(--brand-navy)]")} />
                          {m.label}
                          {locked ? <Crown className="size-3.5 text-[var(--brand-gold)]" /> : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs text-[var(--brand-navy)]/65">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                            isPro
                              ? "border-[var(--brand-gold)]/30 bg-[rgba(245,158,11,0.10)] text-[var(--brand-navy)]"
                              : "border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]/70",
                          )}
                        >
                          {isPro ? (
                            <>
                              <Crown className="size-3.5 text-[var(--brand-gold)]" />
                              Pro
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="size-3.5 text-[var(--brand-navy)]/70" />
                              Free
                            </>
                          )}
                        </span>
                        {!quota.loading ? (
                          <span>
                            {quota.used}/{quota.limit} générations ce mois
                          </span>
                        ) : null}
                      </div>

                      {isPro ? (
                        <Button
                          type="button"
                          variant={responseFormat === "items_3" ? "gold" : "outline"}
                          className={cn("h-9", responseFormat === "items_3" ? undefined : "bg-white")}
                          onClick={() => setResponseFormat((v) => (v === "items_3" ? "single" : "items_3"))}
                        >
                          <Sparkles className="mr-2 size-4" />
                          3 réponses
                        </Button>
                      ) : (
                        <Button asChild type="button" variant="gold" className="h-9">
                          <Link href="/pricing">
                            <Crown className="mr-2 size-4" />
                            Passer Pro
                          </Link>
                        </Button>
                      )}
                    </div>

                    <div className="flex items-end gap-2 rounded-3xl border border-[var(--brand-navy)]/10 bg-white px-3 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Collez le message WhatsApp du client…"
                        className="min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 sm:text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void send(input);
                          }
                        }}
                      />
                      <Button
                        className="h-11 w-11 rounded-full bg-[var(--brand-green)] p-0 text-white shadow-[0_14px_40px_rgba(22,163,74,0.18)] hover:bg-[var(--brand-green)]/90"
                        onClick={() => send(input)}
                        disabled={pending}
                        aria-label="Envoyer"
                      >
                        <Send className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 w-11 rounded-full bg-white p-0"
                        onClick={retryLast}
                        disabled={pending || !lastUserInput}
                        aria-label="Réessayer"
                        title="Réessayer le dernier message"
                      >
                        <RefreshCcw className="size-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--brand-navy)]/55">
                      Astuce: Ctrl+EntRée pour envoyer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--brand-navy)]">Mémoire business</CardTitle>
              <CardDescription>Vos informations pour des réponses cohérentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-6">
              <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4">
                <div className="text-sm font-semibold text-[var(--brand-navy)]">Profil incomplet</div>
                <div className="mt-1 text-sm text-[var(--brand-navy)]/65">
                  Renseignez votre entreprise pour activer une mémoire plus précise (secteur, ville, ton…).
                </div>
                <div className="mt-3">
                  <Button asChild className="w-full">
                    <Link href="/app/profile">
                      Compléter mon profil <ChevronRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <InfoRow label="Entreprise" value={profile.profile?.business_name?.trim() || "—"} icon={Bot} />
                <InfoRow label="Secteur" value={profile.profile?.business_type?.trim() || "—"} icon={Brain} />
                <InfoRow label="Ville" value={profile.profile?.city?.trim() || "—"} icon={Globe} />
                <InfoRow label="Offre" value={profile.profile?.offer?.trim() || "—"} icon={Sparkles} />
                <InfoRow label="Objectif" value={profile.profile?.goal?.trim() || "—"} icon={TrendingUp} />
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--brand-gold)]/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(22,163,74,0.10),rgba(255,255,255,0.55))] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--brand-gold)]/30 bg-white/70 shadow-sm">
                    <Crown className="size-5 text-[var(--brand-gold)]" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[var(--brand-navy)]">Mémoire IA</div>
                    <div className="text-sm text-[var(--brand-navy)]/65">
                      Statut: {mem.status === "active" ? "Active ✅" : "Incomplète ⚠️"} — plus votre contexte est précis, plus vos réponses convertissent.
                    </div>
                    {profile.profile?.updated_at ? (
                      <div className="text-xs text-[var(--brand-navy)]/60">
                        Dernière synchro: {new Date(profile.profile.updated_at).toLocaleString("fr-FR")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, children }: { role: Role; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[85%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-[15px] leading-relaxed shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:max-w-[72%] sm:text-sm",
          "motion-safe:will-change-transform",
          isUser ? "motion-safe:animate-[chatInRight_260ms_ease-out]" : "motion-safe:animate-[chatInLeft_260ms_ease-out]",
          isUser
            ? "bg-[var(--brand-green)] text-white"
            : "bg-white/95 text-[var(--brand-navy)]",
        )}
      >
        {/* Tail */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-4 h-3 w-3 rotate-45",
            isUser
              ? "right-[-5px] bg-[var(--brand-green)] shadow-[0_8px_18px_rgba(15,23,42,0.10)]"
              : "left-[-5px] bg-white/95 shadow-[0_8px_18px_rgba(15,23,42,0.10)]",
          )}
        />
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-[var(--brand-navy)]/35 motion-safe:animate-[typingDot_1.1s_infinite]" />
      <span className="h-2 w-2 rounded-full bg-[var(--brand-navy)]/35 motion-safe:animate-[typingDot_1.1s_infinite_150ms]" />
      <span className="h-2 w-2 rounded-full bg-[var(--brand-navy)]/35 motion-safe:animate-[typingDot_1.1s_infinite_300ms]" />
    </span>
  );
}

function ModelCard({
  active,
  locked,
  title,
  subtitle,
  badges,
  onClick,
}: {
  active: boolean;
  locked?: boolean;
  title: string;
  subtitle: string;
  badges: { label: string; icon: React.ComponentType<{ className?: string }> }[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius)] border bg-white p-4 text-left shadow-sm transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(15,23,42,0.10)] motion-reduce:hover:translate-y-0",
        locked ? "cursor-not-allowed opacity-75 hover:translate-y-0 hover:shadow-sm" : null,
        active
          ? "border-[var(--brand-green)]/25 ring-2 ring-[rgba(22,163,74,0.16)]"
          : "border-[var(--brand-navy)]/10",
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [background:radial-gradient(36rem_20rem_at_10%_0%,rgba(22,163,74,0.12),transparent_55%),radial-gradient(34rem_20rem_at_100%_70%,rgba(245,158,11,0.10),transparent_55%)]" />
      <div className="relative space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--brand-navy)]">
          <span>{title}</span>
          {locked ? <Crown className="size-4 text-[var(--brand-gold)]" /> : null}
        </div>
        <div className="text-xs leading-relaxed text-[var(--brand-navy)]/60">{subtitle}</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <span
                key={b.label}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-navy)]/70"
              >
                <Icon className="size-3 text-[var(--brand-green)]" />
                {b.label}
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-3 py-2">
      <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-navy)]/70">
        <Icon className="size-4 text-[var(--brand-green)]" />
        {label}
      </div>
      <div className="text-xs font-semibold text-[var(--brand-navy)]">{value}</div>
    </div>
  );
}



