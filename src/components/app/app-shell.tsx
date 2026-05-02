"use client";

import { usePathname } from "next/navigation";
import { UnifiedNavbar } from "@/components/nav/unified-navbar";

export function AppShell({ children, initialUserId }: { children: React.ReactNode; initialUserId?: string | null }) {
  usePathname();
  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar initialUserId={initialUserId} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pb-24 sm:pt-6">{children}</main>
    </div>
  );
}
