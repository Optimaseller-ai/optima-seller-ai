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
  { href: "/pricing", label: "Tarifs" },
] as const;

const CENTER_NAV_AUTHED = [
  { href: "/", label: "Home" },
  { href: "/app/chat", label: "Chat IA", requiresPro: true },
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
  const inDashboard = pathname?.startsWith("/app");

  const proLabel = plan === "pro" ? "Plan Pro actif" : "Passer Pro";
  const proDisabled = plan === "pro";

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/70 shadow-[0_18px_55px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_120%_at_50%_0%,black,transparent)]">
            <div className="absolute -left-24 -top-20 h-56 w-56 rounded-full bg-[rgba(59,130,246,0.10)] blur-3xl" />
            <div className="absolute -right-28 -top-16 h-64 w-64 rounded-full bg-[rgba(22,163,74,0.12)] blur-3xl" />
          </div>
          <div className="mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:px-4">
        <Link
          href={isUser ? "/app" : "/"}
          className="flex items-center gap-2 rounded-2xl px-2 py-1 transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(22,163,74,0.20)]"
        >
          <span className="hidden sm:inline">
            <BrandLogo size="desktop" className="text-[var(--brand-navy)] drop-shadow-[0_10px_25px_rgba(15,23,42,0.08)]" />
          </span>
          <span className="sm:hidden">
            <BrandLogo size="mobile" className="text-[var(--brand-navy)] drop-shadow-[0_10px_25px_rgba(15,23,42,0.08)]" />
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-2 md:flex">
          {(isUser ? CENTER_NAV_AUTHED : CENTER_NAV).map((item) => {
            const active = pathname === item.href;
            const isDisabled = item.requiresPro && plan !== "pro";
            return (
              <Link
                key={item.href}
                href={isDisabled ? "#" : item.href}
                className={cn(
                  "relative inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[rgba(22,163,74,0.10)] text-[var(--brand-navy)] shadow-[0_12px_30px_rgba(22,163,74,0.10)] ring-1 ring-[rgba(22,163,74,0.18)]"
                    : isDisabled
                    ? "text-[var(--brand-navy)]/35 cursor-not-allowed"
                    : "text-[var(--brand-navy)]/75 hover:bg-black/[0.03] hover:text-[var(--brand-navy)]",
                )}
                onClick={isDisabled ? (e) => e.preventDefault() : undefined}
              >
                {item.label}
                {item.requiresPro && plan !== "pro" && (
                  <Badge className="ml-2 text-xs">Pro</Badge>
                )}
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
              <Button asChild variant="gold" className="hidden md:inline-flex h-11 shadow-[0_18px_60px_rgba(245,158,11,0.18)]">
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
                    className="hidden md:inline-flex h-11 w-11 rounded-full border-black/10 bg-white/70 p-0 text-[var(--brand-navy)] shadow-sm hover:bg-white"
                    aria-label="Profil"
                  >
                    <User className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/app/profile">Profil</Link>
                  </DropdownMenuItem>
                  {inDashboard ? (
                    <DropdownMenuItem asChild>
                      <Link href="/app/chat">Chat IA</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <Link href="/app/catalog">Catalogue</Link>
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
                className="md:hidden h-11 w-11 rounded-full border-black/10 bg-white/70 p-0 text-[var(--brand-navy)] shadow-sm hover:bg-white"
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
                  <DropdownMenuItem asChild>
                    <Link href="/app/catalog">Catalogue</Link>
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
        </div>
      </div>
    </header>
  );
}
