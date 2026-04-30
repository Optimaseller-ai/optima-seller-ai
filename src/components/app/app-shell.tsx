"use client";

import { usePathname } from "next/navigation";
import { UnifiedNavbar } from "@/components/nav/unified-navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  usePathname();
  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pb-24 sm:pt-6">{children}</main>
    </div>
  );
}
