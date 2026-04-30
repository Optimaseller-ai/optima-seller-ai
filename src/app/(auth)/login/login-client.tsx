"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSiteOriginClient } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export function LoginClient() {
  const search = useSearchParams();
  const nextPath = search.get("next") ?? "/app";
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  async function syncPendingProfile() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("optima:pending_profile");
    if (!raw) return;

    type PendingProfile = {
      full_name: string;
      business_name: string;
      business_type: string;
      city: string;
      country: string;
      whatsapp_number?: string | null;
      main_goal: string;
      brand_tone?: string;
      language?: string;
    };

    let pending: PendingProfile | null = null;
    try {
      pending = JSON.parse(raw) as PendingProfile;
    } catch {
      window.localStorage.removeItem("optima:pending_profile");
      return;
    }

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const firstName = pending.full_name.trim().split(/\s+/)[0] ?? "";
    const payload = {
      id: data.user.id,
      full_name: pending.full_name,
      business_name: pending.business_name,
      business_type: pending.business_type,
      country: pending.country,
      city: pending.city,
      whatsapp_number: pending.whatsapp_number?.trim() ? pending.whatsapp_number.trim() : null,
      main_goal: pending.main_goal,
      brand_tone: pending.brand_tone ?? null,
      language: pending.language ?? null,
      response_style: "Moyen",
      first_name: firstName || null,
      shop_name: pending.business_name,
      onboarding_completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) window.localStorage.removeItem("optima:pending_profile");
  }

  async function cacheProfileClientSide() {
    if (typeof window === "undefined") return;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "full_name,business_name,business_type,city,country,whatsapp_number,main_goal,offer_description,brand_tone,response_style,language,first_name,shop_name",
        )
        .eq("id", data.user.id)
        .maybeSingle();

      window.localStorage.setItem("optima:profile_cache", JSON.stringify({ cachedAt: Date.now(), profile }));
    } catch {
      // ignore
    }
  }

  async function signInGoogle() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${getSiteOriginClient()}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast({
        title: "Google indisponible",
        description: getErrorMessage(err) ?? "Activez Google OAuth dans Supabase Auth, puis réessayez.",
        variant: "destructive",
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();

      // If the project uses different sessions based on remember-me, this is where we'd adjust.
      // Supabase v2 web client doesn't expose a simple per-request remember flag, so we keep UI only for now.
      void remember;

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await syncPendingProfile();
      await cacheProfileClientSide();
      toast({ title: "Connecté", description: "Bienvenue sur Optima Seller AI." });
      window.location.href = nextPath;
    } catch (err: unknown) {
      toast({
        title: "Connexion impossible",
        description: getErrorMessage(err) ?? "Vérifiez vos identifiants ou configurez Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const emailError = touched.email && !email.includes("@") ? "Email invalide." : undefined;
  const passwordError = touched.password && password.length < 6 ? "Mot de passe trop court." : undefined;

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Connexion</CardTitle>
          <CardDescription>Accédez à votre assistant IA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <Button type="button" className="w-full" size="lg" variant="secondary" onClick={signInGoogle} disabled={loading}>
            <Globe className="size-4" />
            Continuer avec Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--brand-navy)]/10" />
            <div className="text-xs font-medium text-[var(--brand-navy)]/50">ou</div>
            <div className="h-px flex-1 bg-[var(--brand-navy)]/10" />
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label className="text-[var(--brand-navy)]" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                autoFocus
                placeholder="Ex: nadine@email.com"
                className={cn(
                  "h-12 text-[15px] sm:h-11 sm:text-sm border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]",
                  emailError ? "border-red-300 focus-visible:ring-red-200" : undefined,
                )}
              />
              {emailError ? <div className="text-xs text-red-600">{emailError}</div> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[var(--brand-navy)]" htmlFor="password">
                  Mot de passe
                </Label>
                <Link href="/reset-password" className="text-xs font-medium text-[var(--brand-green)] hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Votre mot de passe"
                  className={cn(
                    "h-12 pr-11 text-[15px] sm:h-11 sm:text-sm border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.16)]",
                    passwordError ? "border-red-300 focus-visible:ring-red-200" : undefined,
                  )}
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
              {passwordError ? <div className="text-xs text-red-600">{passwordError}</div> : null}
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--brand-navy)]/70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--brand-navy)]/20"
              />
              Se souvenir de moi
            </label>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-[var(--brand-green)] text-white shadow-[0_14px_40px_rgba(22,163,74,0.18)] hover:bg-[var(--brand-green)]/90"
              disabled={loading}
            >
              {loading ? "Connexion…" : "Se connecter"}
            </Button>

            <div className="text-xs text-[var(--brand-navy)]/55">
              Aucune carte bancaire requise. Vos données restent privées.
            </div>
          </form>

          <div className="text-sm text-[var(--brand-navy)]/65">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-[var(--brand-green)] underline underline-offset-4">
              Créer un compte
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}

