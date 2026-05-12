"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChatLinkClient({
  plan,
  slug,
  recentSlugs = [],
}: {
  plan: "free" | "pro";
  slug: string;
  recentSlugs?: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localSlug, setLocalSlug] = useState(slug);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(typeof window !== "undefined" && window.location?.origin ? window.location.origin : "");
  }, []);

  const url = useMemo(() => {
    if (!localSlug) return "";
    const base = origin || "https://tonsite.com";
    return `${base}/chat/${localSlug}`;
  }, [localSlug, origin]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function generateLink() {
    if (plan !== "pro" || busy) return;
    setBusy(true);
    setError("");
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: ctrl.signal,
      }).finally(() => window.clearTimeout(t));

      const data = (await res.json().catch(() => null)) as any;
      if (!data || data.success !== true || typeof data.url !== "string") {
        const raw = typeof data?.error === "string" ? data.error : "Erreur, réessayez";
        const msg =
          raw === "missing_agents_table"
            ? "Base de données: table `agents` manquante. Exécutez `supabase/schema.sql` dans Supabase, puis relancez."
            : raw;
        throw new Error(msg);
      }

      try {
        const u = new URL(String(data.url));
        const parts = u.pathname.split("/").filter(Boolean);
        const nextSlug = parts[0] === "chat" && parts[1] ? parts[1] : "";
        if (nextSlug) setLocalSlug(nextSlug);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.name === "AbortError" ? "Erreur, réessayez" : e?.message ?? "Erreur, réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Chat IA</h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">Partagez ce lien à vos prospects.</p>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Lien partageable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan !== "pro" ? (
            <div className="rounded-2xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--brand-navy)]/80">
              Passez en Pro pour activer le chat IA.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--brand-navy)]/80">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-4 py-3">
            <div className="break-all text-sm text-[var(--brand-navy)]">
              {plan === "pro" ? url || "Cliquez sur “Générer mon lien”." : "https://tonsite.com/chat/{slug}"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {plan === "pro" ? (
              <button
                type="button"
                onClick={generateLink}
                className="h-11 rounded-xl bg-[var(--brand-green)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "Génération..." : "Générer mon lien"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={copy}
              className="h-11 rounded-xl bg-[var(--brand-green)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={plan !== "pro" || !url || busy}
            >
              {copied ? "Copié" : "Copier le lien"}
            </button>

            {plan === "pro" && url ? (
              <Link
                href={url}
                target="_blank"
                className="inline-flex h-11 items-center rounded-xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm font-semibold text-[var(--brand-navy)]"
              >
                Ouvrir le chat
              </Link>
            ) : null}
          </div>

          {plan === "pro" && recentSlugs.length > 1 ? (
            <div className="mt-4 rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-3">
              <div className="text-xs font-semibold text-[var(--brand-navy)]/70">Liens récents (un agent fixe par lien)</div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--brand-navy)]/85">
                {recentSlugs.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full truncate text-left underline-offset-2 hover:underline"
                      onClick={() => setLocalSlug(s)}
                    >
                      {(origin || "…") + "/chat/" + s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

