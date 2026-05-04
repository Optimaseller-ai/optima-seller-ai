import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { BrandLogo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  let isAuthed = false;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      isAuthed = Boolean(data.user);
    }
  } catch {
    // keep public
  }

  return (
    <div className={`${inter.variable} font-sans bg-white text-[#111]`}>
      <header className="border-b border-black/[0.06]">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/25 rounded-xl">
            <BrandLogo className="text-[#111]" size="mobile" />
          </Link>
          {isAuthed ? (
            <Link
              href="/app"
              className="text-sm font-medium text-[#111]/80 transition-colors duration-150 hover:text-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/25 rounded-lg px-3 py-2"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-[#111]/80 transition-colors duration-150 hover:text-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/25 rounded-lg px-3 py-2"
            >
              Se connecter
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-20">{children}</div>

      <footer className="border-t border-black/[0.06]">
        <div className="mx-auto w-full max-w-[720px] px-5 py-8 sm:px-6">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#111]/70">
            <Link className="transition-colors duration-150 hover:text-[#2563eb]" href="/privacy">
              Privacy
            </Link>
            <Link className="transition-colors duration-150 hover:text-[#2563eb]" href="/terms">
              Terms
            </Link>
            <Link className="transition-colors duration-150 hover:text-[#2563eb]" href="/data-deletion">
              Data deletion
            </Link>
            <a className="transition-colors duration-150 hover:text-[#2563eb]" href="mailto:support@optima.ai">
              Contact
            </a>
          </nav>
          <div className="mt-4 text-xs text-[#111]/50">© 2026 Optima Seller AI</div>
        </div>
      </footer>
    </div>
  );
}

