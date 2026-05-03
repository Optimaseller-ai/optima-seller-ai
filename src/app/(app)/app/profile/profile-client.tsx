"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Globe, MapPin, MessageCircleMore, Target, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import { computeMemoryStatus } from "@/lib/data/business-memory";
import { Badge } from "@/components/premium/Badge";
import { WhatsAppConnectClient } from "@/app/(app)/app/whatsapp/whatsapp-connect-client";

type ProfileForm = {
  full_name: string;
  business_name: string;
  business_type: string;
  goal: string;
  country: string;
  city: string;
  whatsapp: string;
  offer: string;
  email: string;
};

const EMPTY: ProfileForm = {
  full_name: "",
  business_name: "",
  business_type: "",
  goal: "",
  country: "",
  city: "",
  whatsapp: "",
  offer: "",
  email: "",
};

export function ProfileClient() {
  const { toast } = useToast();
  const { loading, profile: remoteProfile, upsert, error } = useProfile();
  const mem = computeMemoryStatus(remoteProfile);

  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [form, setForm] = React.useState<ProfileForm>(EMPTY);
  const [accountEmail, setAccountEmail] = React.useState<string | null>(null);
  const [signedUpAt, setSignedUpAt] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const [wa, setWa] = React.useState<null | {
    status?: string | null;
    display_phone_number?: string | null;
    verified_name?: string | null;
    phone_number_id?: string | null;
    last_synced_at?: string | null;
    last_error?: string | null;
  }>(null);
  const [waLoading, setWaLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function loadAuth() {
      try {
        const supabase = createOptionalSupabaseClient();
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (!data.user || cancelled) return;
        setAccountEmail(data.user.email ?? null);
        setSignedUpAt(data.user.created_at ?? null);
      } catch {
        // ignore
      }
    }
    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!remoteProfile) return;
    setForm({
      full_name: remoteProfile.full_name ?? "",
      business_name: remoteProfile.business_name ?? "",
      business_type: remoteProfile.business_type ?? "",
      goal: remoteProfile.goal ?? "",
      country: remoteProfile.country ?? "",
      city: remoteProfile.city ?? "",
      whatsapp: remoteProfile.whatsapp ?? "",
      offer: remoteProfile.offer ?? "",
      email: remoteProfile.email ?? "",
    });
    setDirty(false);
    setLastSyncedAt(remoteProfile.updated_at ?? null);
  }, [remoteProfile]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadWhatsAppStatus() {
      setWaLoading(true);
      try {
        const resp = await fetch("/api/integrations/whatsapp/status");
        const json = (await resp.json().catch(() => ({}))) as any;
        if (cancelled) return;
        if (resp.ok && json?.success) setWa(json.connection ?? null);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setWaLoading(false);
      }
    }
    void loadWhatsAppStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function saveNow(opts?: { showSuccessToast?: boolean }) {
    setSaving(true);
    try {
      await upsert({
        full_name: form.full_name,
        business_name: form.business_name,
        business_type: form.business_type,
        goal: form.goal,
        country: form.country,
        city: form.city,
        whatsapp: form.whatsapp,
        offer: form.offer,
        email: form.email || accountEmail || undefined,
      });
      setLastSyncedAt(new Date().toISOString());
      if (opts?.showSuccessToast !== false) {
        toast({ title: "Enregistré", description: "Profil synchronisé avec Supabase." });
      }
      setDirty(false);
    } catch (err: unknown) {
      toast({
        title: "Erreur d'enregistrement",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const completion = React.useMemo(() => {
    const keys: (keyof ProfileForm)[] = ["full_name", "business_name", "business_type", "goal", "country", "city", "whatsapp", "offer"];
    const filled = keys.filter((k) => String(form[k] ?? "").trim().length > 0).length;
    return Math.round((filled / keys.length) * 100);
  }, [form]);

  const syncLabel = error
    ? "Sync indisponible"
    : loading
      ? "Chargement…"
      : saving
        ? "Enregistrement…"
        : dirty
          ? "Modifications non enregistrées"
          : "Tout est à jour";

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-[var(--radius)] border border-[rgba(22,163,74,0.20)] bg-[linear-gradient(135deg,rgba(22,163,74,0.10),rgba(245,158,11,0.08))] p-4 shadow-[0_18px_55px_rgba(15,23,42,0.10)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-xl font-semibold tracking-tight text-[var(--brand-navy)]">Connectez votre WhatsApp</div>
            <div className="text-sm text-[var(--brand-navy)]/70">Reliez votre compte en 60 secondes pour activer l’IA auto-réponse.</div>
            {wa?.status === "connected" ? (
              <div className="mt-3 grid gap-1 text-sm text-[var(--brand-navy)]/75">
                <div>
                  <span className="font-semibold text-[var(--brand-navy)]">Statut :</span> Connecté
                </div>
                <div>
                  <span className="font-semibold text-[var(--brand-navy)]">Numéro relié :</span>{" "}
                  {wa.display_phone_number || wa.verified_name || wa.phone_number_id || "—"}
                </div>
                <div>
                  <span className="font-semibold text-[var(--brand-navy)]">Dernière synchronisation :</span>{" "}
                  {wa.last_synced_at ? new Date(wa.last_synced_at).toLocaleString("fr-FR") : "—"}
                </div>
              </div>
            ) : null}
            {wa?.last_error ? <div className="mt-2 text-sm text-red-700">{wa.last_error}</div> : null}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <WhatsAppConnectClient connected={wa?.status === "connected"} />
            {waLoading ? <div className="text-xs text-[var(--brand-navy)]/60">Chargement…</div> : null}
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-[var(--brand-navy)]/10 bg-white/70 px-4 py-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-[var(--brand-navy)]">Options avancées</summary>
          <div className="mt-2 text-sm text-[var(--brand-navy)]/70">
            <div>Connexion manuelle (expert) :</div>
            <a className="mt-1 inline-flex font-medium underline underline-offset-4" href="/app/integrations/whatsapp">
              Ouvrir la configuration manuelle
            </a>
          </div>
        </details>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">Profil</h1>
          <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">Ces infos alimentent votre IA (générateur + assistant).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={mem.hasAny ? "success" : "gold"} title="Mémoire business pour l’IA">
            <MessageCircleMore className="size-3.5 text-[var(--brand-green)]" />
            Mémoire {mem.hasAny ? "active" : "à configurer"}
          </Badge>
          <Badge variant={dirty ? "gold" : "muted"}>{syncLabel}</Badge>
          <Button onClick={() => saveNow()} disabled={Boolean(error) || loading || saving || !dirty} className="h-9">
            Enregistrer
          </Button>
        </div>
      </div>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-[var(--brand-navy)]">Infos business</CardTitle>
                <CardDescription>Plus le profil est complet, plus l’IA est pertinente.</CardDescription>
              </div>
              <div className="min-w-[160px]">
                <div className="flex items-center justify-between text-xs text-[var(--brand-navy)]/60">
                  <span className="font-medium text-[var(--brand-navy)]/70">Progression</span>
                  <span className="font-semibold text-[var(--brand-navy)]">{completion}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--brand-navy)]/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(22,163,74,0.90),rgba(245,158,11,0.35))] transition-[width] duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
            <Field icon={User} required label="Nom" value={form.full_name} onChange={(v) => setField("full_name", v)} placeholder="Ex: Nadine" />
            <Field icon={Building2} required label="Nom de la société" value={form.business_name} onChange={(v) => setField("business_name", v)} placeholder="Ex: Nadine Beauty" />
            <Field icon={Target} required label="Type de business" value={form.business_type} onChange={(v) => setField("business_type", v)} placeholder="Ex: e-commerce / service" />
            <Field icon={Target} required label="Objectif principal" value={form.goal} onChange={(v) => setField("goal", v)} placeholder="Ex: +30% ventes WhatsApp" />
            <Field icon={Globe} required label="Pays" value={form.country} onChange={(v) => setField("country", v)} placeholder="Ex: Cameroun" />
            <Field icon={MapPin} required label="Ville" value={form.city} onChange={(v) => setField("city", v)} placeholder="Ex: Yaoundé" />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setField("whatsapp", v)} placeholder="+237..." />
            <Field label="Offre (produit/service + prix si possible)" value={form.offer} onChange={(v) => setField("offer", v)} placeholder="Ex: Packs skincare, livraison 24–48h…" />
            <Field
              label="Email"
              value={form.email || accountEmail || ""}
              onChange={(v) => setField("email", v)}
              placeholder="email@exemple.com"
              helper="Utilisé pour support et compte. Si vide, on prend l’email du compte."
            />
            <div className="hidden sm:block" />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Compte</CardTitle>
              <CardDescription>Données liées à l’auth Supabase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <AccountRow label="Email connecté" value={accountEmail ?? "—"} />
              <AccountRow label="Membre depuis" value={signedUpAt ? new Date(signedUpAt).toLocaleDateString("fr-FR") : "—"} icon={CheckCircle2} />
              <AccountRow
                label="Dernière sauvegarde"
                value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("fr-FR") : "—"}
                icon={CheckCircle2}
              />
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/pricing">Voir les plans</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[rgba(245,158,11,0.25)] bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(22,163,74,0.08))] shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Mémoire IA</CardTitle>
              <CardDescription>Activez un contexte business stable pour des réponses plus “closing”.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-white/80 p-3 text-sm text-[var(--brand-navy)]/75">
                <span className="font-semibold text-[var(--brand-navy)]">Conseil :</span> décrivez votre offre, votre prix et votre zone de livraison.
              </div>
              <Button asChild className="w-full">
                <Link href="/app/chat">Tester l’assistant IA</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--brand-navy)]/10 bg-white/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:hidden">
        <Button size="lg" className="h-11 w-full" disabled={Boolean(error) || loading || saving || !dirty} onClick={() => saveNow()}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

function Req() {
  return <span className="text-[var(--brand-gold)]">*</span>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  helper?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const id = React.useId();
  return (
    <div className="space-y-2 sm:col-span-1">
      <Label htmlFor={id} className="text-[var(--brand-navy)]">
        {label} {required ? <Req /> : null}
      </Label>
      <div className="relative">
        {Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Icon className="size-4 text-[var(--brand-navy)]/45" />
          </div>
        ) : null}
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-12 text-[15px] sm:h-11 sm:text-sm border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]",
            Icon ? "pl-10" : undefined,
          )}
        />
      </div>
      {helper ? <div className="text-xs text-[var(--brand-navy)]/55">{helper}</div> : null}
    </div>
  );
}

function AccountRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-3 py-2">
      <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-navy)]/70">
        {Icon ? <Icon className="size-4 text-[var(--brand-green)]" /> : null}
        {label}
      </div>
      <div className="text-xs font-semibold text-[var(--brand-navy)]">{value}</div>
    </div>
  );
}
