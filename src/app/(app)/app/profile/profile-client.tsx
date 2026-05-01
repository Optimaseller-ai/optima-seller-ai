"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Building2, CheckCircle2, Globe, MapPin, MessageCircleMore, Target, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import { computeMemoryStatus } from "@/lib/data/business-memory";

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
    if (!dirty) return;
    if (loading) return;

    const handle = setTimeout(async () => {
      await saveNow({ showSuccessToast: false });
    }, 650);

    return () => clearTimeout(handle);
  }, [dirty, loading, form]);

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">Profil</h1>
          <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
            Ces informations alimentent votre IA (générateur + assistant).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="bg-white">
            <Link href="/app">Dashboard</Link>
          </Button>
          <StatusPill loading={loading} saving={saving} dirty={dirty} error={error} />
        </div>
      </div>
      {error ? (
        <div className="rounded-[var(--radius)] border border-[var(--brand-gold)]/30 bg-[rgba(245,158,11,0.08)] p-3 text-sm text-[var(--brand-navy)]/80">
          <div className="font-medium text-[var(--brand-navy)]">Action requise</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-[var(--brand-navy)]">
              <span>Business Memory</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  mem.status === "active"
                    ? "border-[var(--brand-green)]/25 bg-[rgba(22,163,74,0.08)] text-[var(--brand-navy)]"
                    : "border-[var(--brand-gold)]/35 bg-[rgba(245,158,11,0.10)] text-[var(--brand-navy)]",
                )}
              >
                AI Memory Status: {mem.status === "active" ? "Active ✅" : "Incomplete ⚠️"}
              </span>
            </CardTitle>
          <CardDescription>
            Autosave instantané + synchronisation temps réel.
              {lastSyncedAt ? (
                <span className="ml-2 text-[var(--brand-navy)]/60">
                  Dernière mise à jour: {new Date(lastSyncedAt).toLocaleString("fr-FR")}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
            <Field icon={User} label="Nom complet" value={form.full_name} onChange={(v) => setField("full_name", v)} />
            <Field
              icon={Building2}
              label="Nom du business"
              value={form.business_name}
              onChange={(v) => setField("business_name", v)}
              required
            />
            <Field
              icon={BadgeCheck}
              label="Secteur (business)"
              value={form.business_type}
              onChange={(v) => setField("business_type", v)}
              placeholder="Ex: vêtements, restaurant, coaching…"
              required
            />
            <Field
              icon={Target}
              label="Objectif principal"
              value={form.goal}
              onChange={(v) => setField("goal", v)}
              placeholder="Ex: vendre plus, support client…"
              required
            />
            <Field
              icon={Globe}
              label="Pays"
              value={form.country}
              onChange={(v) => setField("country", v)}
              required
            />
            <Field icon={MapPin} label="Ville" value={form.city} onChange={(v) => setField("city", v)} required />
            <Field
              icon={MessageCircleMore}
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(v) => setField("whatsapp", v)}
              placeholder="+237..."
            />
            <Field
              label="Offre (produit/service + prix si possible)"
              value={form.offer}
              onChange={(v) => setField("offer", v)}
              placeholder="Ex: Packs skincare, livraison 24–48h…"
            />
            <Field
              label="Email"
              value={form.email || accountEmail || ""}
              onChange={(v) => setField("email", v)}
              placeholder="email@exemple.com"
              helper="Utilisé pour support et compte. Si vide, on prend l'email du compte."
              disabled={false}
            />
          </CardContent>
        </Card>

        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Compte</CardTitle>
            <CardDescription>Données liées à l'auth Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <AccountRow label="Email connecté" value={accountEmail ?? "—"} />
            <AccountRow
              label="Membre depuis"
              value={signedUpAt ? new Date(signedUpAt).toLocaleDateString("fr-FR") : "—"}
              icon={CheckCircle2}
            />
            <Button asChild variant="outline" className="w-full bg-white">
              <Link href="/pricing">Voir les plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--brand-navy)]/10 bg-white/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:hidden">
        <Button size="lg" className="h-11 w-full" disabled>
          {saving ? "Enregistrement…" : dirty ? "Synchronisation…" : "Tout est à jour"}
        </Button>
      </div>
    </div>
  );
}

function StatusPill({
  loading,
  saving,
  dirty,
  error,
}: {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
}) {
  const label = error ? "Sync indisponible" : loading ? "Chargement…" : saving ? "Enregistrement…" : dirty ? "En attente…" : "À jour";
  return (
    <span
      className={cn(
        "inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium shadow-sm",
        error
          ? "border-[var(--brand-gold)]/35 bg-[rgba(245,158,11,0.10)] text-[var(--brand-navy)]"
          : "border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]/80",
      )}
    >
      {label}
    </span>
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
