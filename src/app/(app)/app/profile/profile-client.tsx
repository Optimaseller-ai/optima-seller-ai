"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Crown,
  Globe,
  MapPin,
  MessageCircleMore,
  Save,
  Target,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type Plan = "Free" | "Pro";

type Profile = {
  full_name: string;
  business_name: string;
  business_type: string;
  country: string;
  city: string;
  whatsapp_number: string;
  main_goal: string;
  brand_tone: string;
  response_style: string;
  language: string;
  offer_description: string;
};

const EMPTY: Profile = {
  full_name: "",
  business_name: "",
  business_type: "",
  country: "",
  city: "",
  whatsapp_number: "",
  main_goal: "",
  brand_tone: "",
  response_style: "Moyen",
  language: "Français",
  offer_description: "",
};

export function ProfileClient() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>(EMPTY);
  const [accountEmail, setAccountEmail] = React.useState<string | null>(null);
  const [signedUpAt, setSignedUpAt] = React.useState<string | null>(null);
  const [plan] = React.useState<Plan>("Free");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Connexion requise.");
        setAccountEmail(data.user.email ?? null);
        setSignedUpAt(data.user.created_at ?? null);

        const { data: row } = await supabase
          .from("profiles")
          .select(
            "full_name,business_name,business_type,city,country,whatsapp_number,main_goal,offer_description,brand_tone,response_style,language,first_name,shop_name",
          )
          .eq("id", data.user.id)
          .maybeSingle();

        if (cancelled) return;

        const r = (row ?? {}) as Record<string, unknown>;
        setProfile({
          full_name:
            typeof r.full_name === "string"
              ? r.full_name
              : typeof r.first_name === "string"
                ? r.first_name
                : "",
          business_name:
            typeof r.business_name === "string"
              ? r.business_name
              : typeof r.shop_name === "string"
                ? r.shop_name
                : "",
          business_type: typeof r.business_type === "string" ? r.business_type : "",
          city: typeof r.city === "string" ? r.city : "",
          country: typeof r.country === "string" ? r.country : "",
          whatsapp_number: typeof r.whatsapp_number === "string" ? r.whatsapp_number : "",
          main_goal: typeof r.main_goal === "string" ? r.main_goal : "",
          offer_description: typeof r.offer_description === "string" ? r.offer_description : "",
          brand_tone: typeof r.brand_tone === "string" ? r.brand_tone : "",
          response_style: typeof r.response_style === "string" ? r.response_style : "Moyen",
          language: typeof r.language === "string" ? r.language : "Français",
        });
      } catch {
        // Demo mode / not logged in: keep empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Connexion requise.");

      const firstName = profile.full_name.trim().split(/\s+/)[0] ?? "";
      const payload = {
        id: data.user.id,
        full_name: profile.full_name,
        business_name: profile.business_name,
        business_type: profile.business_type,
        country: profile.country,
        city: profile.city,
        whatsapp_number: profile.whatsapp_number.trim() ? profile.whatsapp_number.trim() : null,
        main_goal: profile.main_goal,
        offer_description: profile.offer_description.trim() ? profile.offer_description.trim() : null,
        brand_tone: profile.brand_tone.trim() ? profile.brand_tone.trim() : null,
        response_style: profile.response_style.trim() ? profile.response_style.trim() : null,
        language: profile.language.trim() ? profile.language.trim() : null,
        // Backward compatible fields
        first_name: firstName || null,
        shop_name: profile.business_name,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast({
        title: "Profil mis à jour avec succès",
        description: "Votre assistant s'adapte à votre business.",
      });
    } catch (err: unknown) {
      toast({
        title: "Sauvegarde impossible",
        description: err instanceof Error ? err.message : "Impossible de sauvegarder.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const completion = React.useMemo(() => {
    const checks = {
      business_name: Boolean(profile.business_name.trim()),
      business_type: Boolean(profile.business_type.trim()),
      city: Boolean(profile.city.trim()),
      offer_description: Boolean(profile.offer_description.trim()),
      brand_tone: Boolean(profile.brand_tone.trim()),
    };
    const done = Object.values(checks).filter(Boolean).length;
    const total = Object.values(checks).length;
    const pct = Math.round((done / total) * 100);
    return { checks, done, total, pct };
  }, [profile]);

  const assistantPct = Math.min(98, Math.max(20, completion.pct + 12));

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
            Profil Business
          </h1>
          <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
            Ces informations permettent à Optima Seller AI de répondre comme votre vrai assistant commercial.
          </p>
        </div>

        <div className="sticky top-[72px] z-10 sm:static">
          <Button size="lg" className="h-11 w-full sm:w-auto" onClick={save} disabled={loading || saving}>
            <Save className="mr-2 size-4" />
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[var(--brand-navy)]">
                <Building2 className="size-5 text-[var(--brand-green)]" />
                Identité business
              </CardTitle>
              <CardDescription>Les bases pour que l’IA parle comme votre équipe.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-3 sm:grid-cols-2 sm:p-6">
              <Field
                label="Nom complet"
                required
                value={profile.full_name}
                onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))}
                placeholder="Ex: Nadine Kouadio"
                disabled={loading}
                icon={User}
              />
              <Field
                label="Nom du business"
                required
                value={profile.business_name}
                onChange={(v) => setProfile((p) => ({ ...p, business_name: v }))}
                placeholder="Ex: Boutique Nadine"
                disabled={loading}
                icon={Building2}
              />
              <Field
                label="Type de business"
                required
                value={profile.business_type}
                onChange={(v) => setProfile((p) => ({ ...p, business_type: v }))}
                placeholder="Ex: Mode, Beauté, Services…"
                disabled={loading}
                icon={BadgeCheck}
              />
              <Field
                label="Pays"
                required
                value={profile.country}
                onChange={(v) => setProfile((p) => ({ ...p, country: v }))}
                placeholder="Ex: Gabon"
                disabled={loading}
                icon={Globe}
              />
              <Field
                label="Ville"
                required
                value={profile.city}
                onChange={(v) => setProfile((p) => ({ ...p, city: v }))}
                placeholder="Ex: Libreville"
                disabled={loading}
                icon={MapPin}
              />
              <Field
                label="WhatsApp professionnel"
                value={profile.whatsapp_number}
                onChange={(v) => setProfile((p) => ({ ...p, whatsapp_number: v }))}
                placeholder="Ex: +241 0x xx xx xx"
                disabled={loading}
                icon={MessageCircleMore}
                helper="Optionnel — utile pour vos modèles de réponse."
              />
            </CardContent>
          </Card>

          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[var(--brand-navy)]">
                <Target className="size-5 text-[var(--brand-green)]" />
                Configuration commerciale
              </CardTitle>
              <CardDescription>Personnalisez le style de l’assistant selon votre marché.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-3 sm:p-6">
              <div className="space-y-2">
                <Label className="text-[var(--brand-navy)]">
                  Objectif principal <Req />
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <ChoiceCard
                      key={g}
                      active={profile.main_goal === g}
                      label={g}
                      onClick={() => setProfile((p) => ({ ...p, main_goal: g }))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--brand-navy)]">
                  Ton de communication <Req />
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TONES.map((t) => (
                    <ChoicePill
                      key={t}
                      active={profile.brand_tone === t}
                      label={t}
                      onClick={() => setProfile((p) => ({ ...p, brand_tone: t }))}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[var(--brand-navy)]">
                    Style de réponse <Req />
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((s) => (
                      <ChoicePill
                        key={s}
                        active={profile.response_style === s}
                        label={s}
                        onClick={() => setProfile((p) => ({ ...p, response_style: s }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[var(--brand-navy)]">
                    Langue principale <Req />
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGS.map((l) => (
                      <ChoicePill
                        key={l}
                        active={profile.language === l}
                        label={l}
                        onClick={() => setProfile((p) => ({ ...p, language: l }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Offre / Produits</CardTitle>
              <CardDescription>Décrivez vos produits, services ou offres pour des réponses plus pertinentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 sm:p-6">
              <Label htmlFor="offer" className="text-[var(--brand-navy)]">
                Décrivez vos produits, services ou offres <Req />
              </Label>
              <textarea
                id="offer"
                value={profile.offer_description}
                onChange={(e) => setProfile((p) => ({ ...p, offer_description: e.target.value }))}
                placeholder="Ex: Vente de chaussures homme/femme. Livraison 24h. Paiement à la livraison."
                disabled={loading}
                className="min-h-32 w-full rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-3 py-2 text-[15px] leading-relaxed text-[var(--brand-navy)] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)] sm:text-sm"
              />
              <div className="text-xs text-[var(--brand-navy)]/55">
                Conseil: mentionnez prix, livraison, paiement, garanties, et vos best-sellers.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Statut assistant</CardTitle>
              <CardDescription>Plus votre profil est complet, plus l’IA vend mieux.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-3 sm:p-6">
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div className="text-sm font-semibold text-[var(--brand-navy)]">
                    Assistant prêt à {assistantPct}%
                  </div>
                  <div className="text-xs text-[var(--brand-navy)]/55">
                    {completion.done}/{completion.total}
                  </div>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--background))]">
                  <div
                    className="h-full rounded-full bg-[var(--brand-green)] shadow-[0_0_0_1px_rgba(22,163,74,0.18)]"
                    style={{ width: `${assistantPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <CheckRow ok={completion.checks.business_name} label="Nom business" />
                <CheckRow ok={completion.checks.business_type} label="Secteur rempli" />
                <CheckRow ok={completion.checks.city} label="Ville remplie" />
                <CheckRow ok={completion.checks.offer_description} label="Offre remplie" />
                <CheckRow ok={completion.checks.brand_tone} label="Tonalité à choisir" />
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  const el = document.getElementById("offer");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={loading}
              >
                Compléter profil
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Compte</CardTitle>
              <CardDescription>Informations liées à votre accès.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-6">
              <AccountRow label="Email connecté" value={accountEmail ?? "—"} />
              <AccountRow label="Plan actuel" value={plan} icon={Crown} />
              <AccountRow
                label="Date inscription"
                value={signedUpAt ? new Date(signedUpAt).toLocaleDateString("fr-FR") : "—"}
                icon={CheckCircle2}
              />
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/pricing">Voir les plans</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--brand-navy)]/10 bg-white/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:hidden">
        <Button size="lg" className="h-11 w-full" onClick={save} disabled={loading || saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
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
    <div className="space-y-2">
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

function ChoiceCard({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius)] border bg-white px-4 py-3 text-left text-sm font-medium shadow-sm transition",
        active ? "border-[var(--brand-green)]/25 ring-2 ring-[rgba(22,163,74,0.16)]" : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
      )}
    >
      {label}
    </button>
  );
}

function ChoicePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-[var(--radius)] border bg-white px-3 text-sm font-medium text-[var(--brand-navy)] transition",
        active ? "border-[var(--brand-green)]/25 ring-2 ring-[rgba(22,163,74,0.16)]" : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
      )}
    >
      {label}
    </button>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-3 py-2">
      <div className="text-sm font-medium text-[var(--brand-navy)]/70">{label}</div>
      <div className={cn("text-sm font-semibold", ok ? "text-[var(--brand-green)]" : "text-[var(--brand-navy)]/35")}>
        {ok ? "✓" : "○"}
      </div>
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

const GOALS = ["Vendre plus", "Support client", "Générer prospects", "Fidéliser"] as const;
const TONES = ["Professionnel", "Chaleureux", "Premium", "Direct"] as const;
const STYLES = ["Court", "Moyen", "Détaillé"] as const;
const LANGS = ["Français", "English", "Bilingue"] as const;

