"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
        options: { redirectTo: `${window.location.origin}${nextPath}` },
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
