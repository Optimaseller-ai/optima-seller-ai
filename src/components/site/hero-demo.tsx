"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { generateMessages } from "@/app/(app)/app/generator/actions";
import { useToast } from "@/components/ui/toaster";

export function HeroDemo() {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("C’est combien ?");
  const [reply, setReply] = React.useState<string | null>(null);

  function run() {
    startTransition(async () => {
      try {
        const res = await generateMessages({ mode: "reply", input: message, tone: "pro" });
        setReply(res.items[0] ?? null);
      } catch (err) {
        toast({
          title: "Erreur",
          description: err instanceof Error ? err.message : "Impossible de generer.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card className="bg-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          Demonstration immediate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="hero-message">Message client</Label>
          <Input
            id="hero-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="ex: C’est combien ?"
          />
        </div>
        <Button className="w-full" size="lg" onClick={run} disabled={pending}>
          {pending ? "Generation..." : "Generer ma reponse"}
        </Button>
        {reply ? (
          <div className="rounded-[var(--radius)] border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {reply}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

