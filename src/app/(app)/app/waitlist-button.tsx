"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";

export function WaitlistButton({ feature }: { feature: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [authed, setAuthed] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!canceled) setAuthed(Boolean(data.user));
      } catch {
        if (!canceled) setAuthed(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  async function join() {
    try {
      setLoading(true);
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Impossible d’enregistrer votre demande.");
      toast({ title: "C’est noté", description: "Vous êtes sur la liste d’attente." });
    } catch (err) {
      toast({
        title: "Liste d’attente",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (authed === false) {
    return (
      <Button asChild size="lg" className="h-11 w-full">
        <Link href="/signup">Créer un compte</Link>
      </Button>
    );
  }

  return (
    <Button size="lg" className="h-11 w-full" onClick={() => void join()} disabled={loading || authed === null}>
      {loading ? "Enregistrement…" : "Je veux cette fonction"}
    </Button>
  );
}

