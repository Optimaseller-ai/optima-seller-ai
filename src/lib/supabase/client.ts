import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieAdapter = {
    getAll() {
      if (typeof document === "undefined") return [];
      const raw = document.cookie ?? "";
      if (!raw) return [];
      return raw
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const idx = p.indexOf("=");
          if (idx < 0) return { name: p, value: "" };
          return { name: decodeURIComponent(p.slice(0, idx)), value: decodeURIComponent(p.slice(idx + 1)) };
        });
    },
    setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
      if (typeof document === "undefined") return;
      cookiesToSet.forEach(({ name, value, options }) => {
        const opt = options ?? {};
        const path = opt.path ?? "/";
        const maxAge = typeof opt.maxAge === "number" ? `; Max-Age=${opt.maxAge}` : "";
        const expires = opt.expires ? `; Expires=${new Date(opt.expires).toUTCString()}` : "";
        const sameSite = opt.sameSite ? `; SameSite=${opt.sameSite}` : "";
        const secure = opt.secure ? "; Secure" : "";
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}${maxAge}${expires}${sameSite}${secure}`;
      });
    },
  };

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: cookieAdapter as any,
  });
}
