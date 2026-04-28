"use client";

import Link from "next/link";
import * as React from "react";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSiteOriginClient } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";

export default function SignupPage() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${getSiteOriginClient()}/auth/callback?next=/app` },
      });
      if (error) throw error;

      toast({
        title: "Compte cree",
        description:
          "Connectez-vous pour continuer. Si la confirmation email est activee, verifiez votre boite mail.",
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
        title: "Google login indisponible",
        description:
          getErrorMessage(err) ??
          "Activez Google OAuth dans Supabase Auth, puis reessayez.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Essai gratuit</CardTitle>
        <CardDescription>10 generations/mois en version Free.</CardDescription>
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
              placeholder="ex: ismael@gmail.com"
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
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">Minimum 6 caracteres.</p>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creation..." : "Creer mon compte"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-muted-foreground">
          Deja un compte ?{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Se connecter
          </Link>
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
