import "server-only";

import crypto from "node:crypto";
import { env } from "@/lib/env";

export type MetaTokenExchangeResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export function requireMetaEnv() {
  if (!env.META_APP_ID) throw new Error("Missing env META_APP_ID.");
  if (!env.META_APP_SECRET) throw new Error("Missing env META_APP_SECRET.");
  if (!env.META_CONFIG_ID) throw new Error("Missing env META_CONFIG_ID.");
  if (!env.WHATSAPP_VERIFY_TOKEN && !env.META_VERIFY_TOKEN) throw new Error("Missing env WEBHOOK_VERIFY_TOKEN (WHATSAPP_VERIFY_TOKEN or META_VERIFY_TOKEN).");
  if (!env.WHATSAPP_TOKEN_ENC_KEY) throw new Error("Missing env WHATSAPP_TOKEN_ENC_KEY.");
}

export function generateState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function signState(state: string) {
  const secret = env.META_OAUTH_STATE_SECRET ?? env.META_APP_SECRET ?? "";
  if (!secret) throw new Error("Missing env META_OAUTH_STATE_SECRET (or META_APP_SECRET).");
  const mac = crypto.createHmac("sha256", secret).update(state, "utf8").digest("base64url");
  return `${state}.${mac}`;
}

export function verifySignedState(signed: string) {
  const [state, mac] = signed.split(".", 2);
  if (!state || !mac) return null;
  const secret = env.META_OAUTH_STATE_SECRET ?? env.META_APP_SECRET ?? "";
  if (!secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(state, "utf8").digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  } catch {
    return null;
  }
  return state;
}

export function buildEmbeddedSignupUrl(opts: { redirectUri: string; signedState: string }) {
  requireMetaEnv();
  const u = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  u.searchParams.set("client_id", env.META_APP_ID!);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.signedState);
  u.searchParams.set("response_type", "code");
  // Embedded Signup: config_id is required to launch WhatsApp onboarding flow
  u.searchParams.set("config_id", env.META_CONFIG_ID!);
  // Scopes needed to manage WABA + phone numbers + subscribe apps
  u.searchParams.set("scope", "business_management,whatsapp_business_management,whatsapp_business_messaging");
  return u.toString();
}

export async function exchangeCodeForToken(opts: { code: string; redirectUri: string }) {
  requireMetaEnv();
  const url = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  url.searchParams.set("client_id", env.META_APP_ID!);
  url.searchParams.set("client_secret", env.META_APP_SECRET!);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("code", opts.code);

  const resp = await fetch(url.toString(), { method: "GET" });
  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `Meta token exchange failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }
  if (!json?.access_token) throw new Error("Meta token exchange failed: missing access_token.");
  return json as MetaTokenExchangeResponse;
}

export async function debugToken(opts: { accessToken: string }) {
  requireMetaEnv();
  const url = new URL("https://graph.facebook.com/v23.0/debug_token");
  url.searchParams.set("input_token", opts.accessToken);
  url.searchParams.set("access_token", `${env.META_APP_ID}|${env.META_APP_SECRET}`);
  const resp = await fetch(url.toString(), { method: "GET" });
  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `debug_token failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }
  return json as unknown;
}

export type DiscoveredWhatsApp = {
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
};

export async function discoverWabaAndPhone(opts: { accessToken: string }): Promise<DiscoveredWhatsApp> {
  // Best-effort discovery: depends on permissions granted during signup.
  const url = new URL("https://graph.facebook.com/v23.0/me");
  url.searchParams.set(
    "fields",
    [
      "id",
      "whatsapp_business_accounts{",
      "id,name,phone_numbers{id,display_phone_number,verified_name}",
      "}",
    ].join(""),
  );
  url.searchParams.set("access_token", opts.accessToken);
  const resp = await fetch(url.toString(), { method: "GET" });
  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `Meta discovery failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  const businessId = typeof json?.id === "string" ? json.id : null;
  const waba = json?.whatsapp_business_accounts?.data?.[0] ?? null;
  const wabaId = typeof waba?.id === "string" ? waba.id : null;
  const phone = waba?.phone_numbers?.data?.[0] ?? null;
  const phoneNumberId = typeof phone?.id === "string" ? phone.id : null;
  const displayPhoneNumber = typeof phone?.display_phone_number === "string" ? phone.display_phone_number : null;
  const verifiedName = typeof phone?.verified_name === "string" ? phone.verified_name : null;

  return { businessId, wabaId, phoneNumberId, displayPhoneNumber, verifiedName };
}

export async function subscribeAppToWaba(opts: { accessToken: string; wabaId: string }) {
  const url = new URL(`https://graph.facebook.com/v23.0/${encodeURIComponent(opts.wabaId)}/subscribed_apps`);
  url.searchParams.set("access_token", opts.accessToken);
  const resp = await fetch(url.toString(), { method: "POST" });
  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : `Subscribe app failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }
  return json as unknown;
}

