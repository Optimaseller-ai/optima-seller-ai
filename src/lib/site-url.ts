import { env } from "@/lib/env";

type RequestLike = {
  headers: Headers;
};

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export function getSiteOriginClient() {
  if (env.NEXT_PUBLIC_SITE_URL) return normalizeOrigin(env.NEXT_PUBLIC_SITE_URL);
  if (typeof window !== "undefined" && window.location?.origin) return normalizeOrigin(window.location.origin);
  return "http://localhost:3000";
}

export function getSiteOriginFromRequest(req: RequestLike) {
  // Prefer forwarded headers on Vercel/Proxies.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.headers.get("x-forwarded-server");

  if (host) return normalizeOrigin(`${proto}://${host}`);
  if (env.NEXT_PUBLIC_SITE_URL) return normalizeOrigin(env.NEXT_PUBLIC_SITE_URL);
  return "http://localhost:3000";
}

