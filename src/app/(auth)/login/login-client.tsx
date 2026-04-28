"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSiteOriginClient } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";

export function LoginClient() {
  const search = useSearchParams();
  const nextPath = search.get("next") ?? "/app";
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sendingLink, setSendingLink] = React.useState(false);
  const [sendingReset, setSendingReset] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = nextPath;
    } catch (err: unknown) {
      toast({
        title: "Connexion impossible",
        description:
          getErrorMessage(err) ??
          "Configurez Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) ou verifiez vos identifiants.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        title: "Google login indisponible",
        description:
          getErrorMessage(err) ??
          "Activez Google OAuth dans Supabase Auth, puis reessayez.",
        variant: "destructive",
      });
    }
  }

  async function sendMagicLink() {
    if (!email) return;
    setSendingLink(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getSiteOriginClient()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;

      toast({
        title: "Lien envoye",
        description: "Verifiez votre email et ouvrez le lien pour vous connecter.",
      });
    } catch (err: unknown) {
      toast({
        title: "Envoi impossible",
        description: getErrorMessage(err) ?? "Impossible d'envoyer le lien magique.",
        variant: "destructive",
      });
    } finally {
      setSendingLink(false);
    }
  }

  async function sendPasswordReset() {
    if (!email) return;
    setSendingReset(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteOriginClient()}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;

      toast({
        title: "Email envoye",
        description: "Ouvrez le lien dans votre email pour choisir un nouveau mot de passe.",
      });
    } catch (err: unknown) {
      toast({
        title: "Reset impossible",
        description: getErrorMessage(err) ?? "Impossible d'envoyer l'email de reinitialisation.",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accedez a votre dashboard et a l&apos;IA.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" className="w-full" size="lg" variant="secondary" onClick={signInGoogle}>
          <Globe className="size-4" />
          Continuer avec Google
        </Button>
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-xs text-muted-foreground">ou</div>
          <div className="h-px flex-1 bg-border" />
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: nadine@gmail.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        <div className="mt-3 grid gap-2">
          <Button type="button" variant="outline" className="w-full" disabled={sendingLink || !email} onClick={sendMagicLink}>
            {sendingLink ? "Envoi du lien..." : "Recevoir un lien de connexion"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs"
            disabled={sendingReset || !email}
            onClick={sendPasswordReset}
          >
            {sendingReset ? "Envoi..." : "Mot de passe oublie ? (reset)"}
          </Button>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Pas de compte ?{" "}
          <Link href="/signup" className="text-primary underline underline-offset-4">
            Creer un compte
          </Link>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Google login est optionnel et doit etre active dans Supabase Auth.
        </div>
      </CardContent>
    </Card>
  );
}

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}
