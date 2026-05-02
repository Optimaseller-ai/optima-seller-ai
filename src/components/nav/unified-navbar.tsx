"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { useSubscription, isSubscriptionActive } from "@/lib/data/use-subscription";
import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import { useProfile } from "@/lib/data/use-profile";
import { Badge } from "@/components/premium/Badge";
import { UpgradeButton } from "@/components/premium/UpgradeButton";

type Plan = "free" | "pro";

const CENTER_NAV = [
  { href: "/", label: "Home" },
  { href: "/app/chat", label: "IA" },
  { href: "/pricing", label: "Tarifs" },
] as const;

export function UnifiedNavbar({ initialUserId }: { initialUserId?: string | null } = {}) {
  const pathname = usePathname();
  const { toast } = useToast();

  const sub = useSubscription();
  const profileState = useProfile();
  const userLoaded = !sub.loading;
  const effectiveUserId = sub.userId ?? initialUserId ?? null;
  const isAuthed = Boolean(effectiveUserId);
  const plan: Plan = isSubscriptionActive(sub.subscription) && sub.subscription?.plan === "pro" ? "pro" : "free";

  const showMemoryBadge = process.env.NODE_ENV !== "production";
  const memoryLoaded =
    !profileState.loading &&
    Boolean(
      profileState.profile?.business_name ||
        profileState.profile?.business_type ||
        profileState.profile?.country ||
        profileState.profile?.city ||
        profileState.profile?.offer ||
        profileState.profile?.goal,
    );

  async function signOut() {
    try {
      const supabase = createOptionalSupabaseClient();
      if (!supabase) throw new Error("Supabase non configuré.");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast({
        title: "Déconnexion",
        description: "Supabase non configuré. Redirection vers l’accueil.",
      });
      window.location.href = "/";
    }
  }

  const isGuest = userLoaded && !isAuthed;
  const isUser = userLoaded && isAuthed;

  const proLabel = plan === "pro" ? "Plan Pro actif" : "Passer Pro";
  const proDisabled = plan === "pro";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--brand-navy)]/10 bg-white/80 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.30)] backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href={isUser ? "/app" : "/"}
          className="flex items-center gap-2 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.18)]"
        >
          <span className="hidden sm:inline">
            <BrandLogo size="desktop" className="text-[var(--brand-navy)] drop-shadow-[0_10px_25px_rgba(15,23,42,0.08)]" />
          </span>
          <span className="sm:hidden">
            <BrandLogo size="mobile" className="text-[var(--brand-navy)] drop-shadow-[0_10px_25px_rgba(15,23,42,0.08)]" />
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-2 md:flex">
          {CENTER_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition",
                  active
                    ? "bg-[var(--brand-green)] text-white shadow-sm"
                    : "text-[var(--brand-navy)]/80 hover:bg-[var(--brand-navy)]/5 hover:text-[var(--brand-navy)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          {showMemoryBadge && isUser ? (
            <Badge
              className="hidden md:inline-flex"
              variant={memoryLoaded ? "success" : "gold"}
              title={memoryLoaded ? "Mémoire business chargée" : "Aucune mémoire business détectée"}
            >
              <span className={cn("h-2 w-2 rounded-full", memoryLoaded ? "bg-emerald-500" : "bg-[var(--brand-gold)]")} />
              Mémoire
            </Badge>
          ) : null}

          {isGuest ? (
            <>
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild variant="gold" className="hidden md:inline-flex h-11">
                <Link href="/signup">Essai gratuit 7 jours</Link>
              </Button>
            </>
          ) : null}

          {isUser ? (
            <>
              <span className="hidden md:inline-flex">
                {proDisabled ? <Badge variant="pro">PRO</Badge> : <UpgradeButton disabled={proDisabled} label={proLabel} />}
              </span>
              <Button asChild variant="outline" className="hidden md:inline-flex h-11 bg-white">
                <Link href="/app">Dashboard</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="hidden md:inline-flex h-11 w-11 rounded-full border-[var(--brand-navy)]/15 bg-white p-0 text-[var(--brand-navy)]"
                    aria-label="Profil"
                  >
                    <User className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/app/profile">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/pricing">Tarifs</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>Se déconnecter</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="md:hidden h-11 w-11 rounded-full border-[var(--brand-navy)]/15 bg-white p-0 text-[var(--brand-navy)]"
                aria-label="Menu"
              >
                <Menu className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/">Home</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/chat">IA</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/pricing">Tarifs</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {isUser ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/app">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/app/profile">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn(proDisabled ? "pointer-events-none opacity-70" : undefined)}>
                    <Link href="/pricing">{proLabel}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>Se déconnecter</DropdownMenuItem>
                </>
              ) : isGuest ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/login">Se connecter</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/signup">Essai gratuit 7 jours</Link>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
