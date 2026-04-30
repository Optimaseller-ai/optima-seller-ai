"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSiteOriginClient } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

type SignupProfile = {
  full_name: string;
  business_name: string;
  business_type: string;
  country: string;
  city: string;
  whatsapp_number: string;
  main_goal: string;
  brand_tone: string;
  language: string;
};

const EMPTY: SignupProfile = {
  full_name: "",
  business_name: "",
  business_type: "",
  country: "",
  city: "",
  whatsapp_number: "",
  main_goal: "",
  brand_tone: "",
  language: "Français",
};

export function SignupClient() {
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>(1);
  const [profile, setProfile] = React.useState<SignupProfile>(EMPTY);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const canStep1 =
    profile.full_name.trim().length >= 2 &&
    email.includes("@") &&
    password.length >= 6;

  const canStep2 =
    profile.business_name.trim().length >= 2 &&
    profile.business_type.trim().length >= 2 &&
    profile.country.trim().length >= 2 &&
    profile.city.trim().length >= 2;

  const canStep3 =
    Boolean(profile.main_goal) &&
    Boolean(profile.brand_tone) &&
    Boolean(profile.language);

  async function signInGoogle() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${getSiteOriginClient()}/auth/callback?next=/app` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast({
        title: "Google indisponible",
        description: getErrorMessage(err) ?? "Activez Google OAuth dans Supabase Auth.",
        variant: "destructive",
      });
    }
  }

  function nextStep() {
    if (step === 1 && !canStep1) return;
    if (step === 2 && !canStep2) return;
    setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
  }

  function prevStep() {
    setStep((s) => (s === 3 ? 2 : 1));
  }

  async function submit() {
    if (!canStep1 || !canStep2 || !canStep3) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteOriginClient()}/auth/callback?next=/app`,
          data: {
            optima_profile: {
              ...profile,
            },
          },
        },
      });
      if (error) throw error;

      // Best effort profile persistence (if confirmation is off).
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const firstName = profile.full_name.trim().split(/\s+/)[0] ?? "";
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              full_name: profile.full_name,
              business_name: profile.business_name,
              business_type: profile.business_type,
              country: profile.country,
              city: profile.city,
              whatsapp_number: profile.whatsapp_number.trim() ? profile.whatsapp_number.trim() : null,
              main_goal: profile.main_goal,
              brand_tone: profile.brand_tone,
              language: profile.language,
              response_style: "Moyen",
              first_name: firstName || null,
              shop_name: profile.business_name,
              onboarding_completed: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          window.localStorage.removeItem("optima:pending_profile");
        } else {
          window.localStorage.setItem("optima:pending_profile", JSON.stringify(profile));
        }
      } catch {
        window.localStorage.setItem("optima:pending_profile", JSON.stringify(profile));
      }

      toast({
        title: "Compte créé",
        description: "Connectez-vous pour continuer. Aucune carte bancaire requise.",
      });
      window.location.href = "/login";
    } catch (err: unknown) {
      toast({
        title: "Inscription impossible",
        description:
          getErrorMessage(err) ??
          "Configurez Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) pour activer l'auth.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Créer votre compte</CardTitle>
          <CardDescription>Essai gratuit, 10 générations offertes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <Button
            type="button"
            className="w-full"
            size="lg"
            variant="secondary"
            onClick={signInGoogle}
            disabled={loading}
          >
            <Globe className="size-4" />
            Continuer avec Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--brand-navy)]/10" />
            <div className="text-xs font-medium text-[var(--brand-navy)]/50">ou</div>
            <div className="h-px flex-1 bg-[var(--brand-navy)]/10" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--brand-navy)]">
                Étape {step} sur 3
              </div>
              <div className="text-xs text-[var(--brand-navy)]/55">
                {step === 1 ? "Compte" : step === 2 ? "Business" : "Objectifs"}
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--background))]">
              <div
                className="h-full rounded-full bg-[var(--brand-green)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
              />
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <Field
                label="Nom complet"
                required
                value={profile.full_name}
                onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))}
                placeholder="Ex: Nadine Kouadio"
                autoFocus
                error={touched.full_name && profile.full_name.trim().length < 2 ? "Entrez votre nom." : undefined}
                onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
              />
              <Field
                label="Email"
                required
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Ex: nadine@email.com"
                error={touched.email && !email.includes("@") ? "Email invalide." : undefined}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              />
              <div className="space-y-2">
                <Label className="text-[var(--brand-navy)]">
                  Mot de passe <Req />
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    minLength={6}
                    className="h-12 pr-11 text-[15px] sm:h-11 sm:text-sm border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]"
                    placeholder="Minimum 6 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-2 inline-flex h-full items-center justify-center rounded-xl px-2 text-[var(--brand-navy)]/55 hover:text-[var(--brand-navy)]"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="text-xs text-[var(--brand-navy)]/55">
                  Vos données restent privées.
                </div>
                {touched.password && password.length < 6 ? (
                  <div className="text-xs text-red-600">Minimum 6 caractères.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <Field
                label="Nom du business"
                required
                value={profile.business_name}
                onChange={(v) => setProfile((p) => ({ ...p, business_name: v }))}
                placeholder="Ex: Optima Boutique"
              />
              <Field
                label="Type de business"
                required
                value={profile.business_type}
                onChange={(v) => setProfile((p) => ({ ...p, business_type: v }))}
                placeholder="Ex: Mode, Beauté, Services…"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Pays"
                  required
                  value={profile.country}
                  onChange={(v) => setProfile((p) => ({ ...p, country: v }))}
                  placeholder="Ex: Gabon"
                />
                <Field
                  label="Ville"
                  required
                  value={profile.city}
                  onChange={(v) => setProfile((p) => ({ ...p, city: v }))}
                  placeholder="Ex: Libreville"
                />
              </div>
              <Field
                label="WhatsApp"
                value={profile.whatsapp_number}
                onChange={(v) => setProfile((p) => ({ ...p, whatsapp_number: v }))}
                placeholder="Ex: +241 0x xx xx xx"
                helper="Optionnel — utile pour vos réponses."
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <SelectGrid
                label="Objectif principal"
                required
                value={profile.main_goal}
                options={["Vendre plus", "Support client", "Générer prospects", "Fidéliser"]}
                onChange={(v) => setProfile((p) => ({ ...p, main_goal: v }))}
              />
              <SelectGrid
                label="Ton de communication"
                required
                value={profile.brand_tone}
                options={["Professionnel", "Chaleureux", "Premium", "Direct"]}
                onChange={(v) => setProfile((p) => ({ ...p, brand_tone: v }))}
              />
              <SelectGrid
                label="Langue"
                required
                value={profile.language}
                options={["Français", "English", "Bilingue"]}
                onChange={(v) => setProfile((p) => ({ ...p, language: v }))}
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="flex gap-2">
              {step > 1 ? (
                <Button type="button" variant="outline" className="flex-1 bg-white" onClick={prevStep} disabled={loading}>
                  Retour
                </Button>
              ) : null}
              {step < 3 ? (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={nextStep}
                  disabled={loading || (step === 1 ? !canStep1 : !canStep2)}
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1 bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green)]/90"
                  onClick={submit}
                  disabled={loading || !canStep3}
                >
                  {loading ? "Création…" : "Créer mon compte gratuitement"}
                </Button>
              )}
            </div>
            <div className="text-xs text-[var(--brand-navy)]/55">
              Aucune carte bancaire requise.
            </div>
          </div>

          <div className="text-sm text-[var(--brand-navy)]/65">
            Déjà membre ?{" "}
            <Link href="/login" className="font-medium text-[var(--brand-green)] underline underline-offset-4">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Req() {
  return <span className="text-[var(--brand-gold)]">*</span>;
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type,
  autoFocus,
  helper,
  error,
  onBlur,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  helper?: string;
  error?: string;
  onBlur?: () => void;
}) {
  const id = React.useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[var(--brand-navy)]">
        {label} {required ? <Req /> : null}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onBlur={onBlur}
        className={cn(
          "h-12 text-[15px] sm:h-11 sm:text-sm border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]",
          error ? "border-red-300 focus-visible:ring-red-200" : undefined,
        )}
      />
      {helper ? <div className="text-xs text-[var(--brand-navy)]/55">{helper}</div> : null}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function SelectGrid({
  label,
  required,
  value,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[var(--brand-navy)]">
        {label} {required ? <Req /> : null}
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-11 rounded-[var(--radius)] border bg-white px-3 text-left text-sm font-medium text-[var(--brand-navy)] transition",
                active
                  ? "border-[var(--brand-green)]/25 ring-2 ring-[rgba(22,163,74,0.16)]"
                  : "border-[var(--brand-navy)]/10 hover:bg-[hsl(var(--background))]",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}

