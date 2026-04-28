"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessagesSquare, KanbanSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/generator", label: "IA", icon: MessagesSquare },
  { href: "/app/crm", label: "CRM", icon: KanbanSquare },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();

  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast({
        title: "Deconnexion",
        description: "Supabase non configure. Redirection vers l'accueil.",
      });
      window.location.href = "/";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/app" className="focus-visible:outline-none">
            <BrandLogo />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="h-11">
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/onboarding">Modifier profil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/pricing">Tarifs</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>Se deconnecter</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-3 px-2 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-[var(--radius)] px-2 py-2 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary" : undefined)} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

