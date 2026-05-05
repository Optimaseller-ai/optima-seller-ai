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
  if (!env.META_REDIRECT_URI) throw new Error("Missing env META_REDIRECT_URI.");
  if (!env.WHATSAPP_VERIFY_TOKEN) throw new Error("Missing env WHATSAPP_VERIFY_TOKEN.");
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
  const u = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  u.searchParams.set("client_id", env.META_APP_ID!);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.signedState);
  u.searchParams.set("response_type", "code");
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
  phoneNumber: string | null;
};

export async function discoverWabaAndPhone(opts: { accessToken: string }): Promise<DiscoveredWhatsApp> {
  // Official flow:
  // 1) /me/businesses
  // 2) /{business_id}/owned_whatsapp_business_accounts
  // 3) /{waba_id}/phone_numbers
  const headers = {
    Authorization: `Bearer ${opts.accessToken}`,
  };

  // 1) businesses
  const businessesResp = await fetch("https://graph.facebook.com/v19.0/me/businesses", { method: "GET", headers });
  const businessesJson = (await businessesResp.json().catch(() => ({}))) as any;
  console.log("Meta discovery: businesses", { status: businessesResp.status, ok: businessesResp.ok, json: businessesJson });
  if (!businessesResp.ok) {
    const msg =
      typeof businessesJson?.error?.message === "string"
        ? businessesJson.error.message
        : `Meta discovery businesses failed (HTTP ${businessesResp.status})`;
    throw new Error(msg);
  }

  const businessId = typeof businessesJson?.data?.[0]?.id === "string" ? String(businessesJson.data[0].id) : null;
  if (!businessId) throw new Error("Aucun Business trouvé sur votre compte Meta. Vérifiez l'accès Business Manager.");

  // 2) owned WhatsApp Business Accounts
  const wabaResp = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts`,
    { method: "GET", headers },
  );
  const wabaJson = (await wabaResp.json().catch(() => ({}))) as any;
  console.log("Meta discovery: owned_whatsapp_business_accounts", { status: wabaResp.status, ok: wabaResp.ok, json: wabaJson });
  if (!wabaResp.ok) {
    const msg =
      typeof wabaJson?.error?.message === "string"
        ? wabaJson.error.message
        : `Meta discovery WABA failed (HTTP ${wabaResp.status})`;
    throw new Error(msg);
  }

  const wabaId = typeof wabaJson?.data?.[0]?.id === "string" ? String(wabaJson.data[0].id) : null;
  if (!wabaId) throw new Error("Aucun WhatsApp Business Account (WABA) trouvé. Vérifiez votre configuration WhatsApp Business.");

  // 3) phone numbers
  const phoneResp = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(wabaId)}/phone_numbers`, {
    method: "GET",
    headers,
  });
  const phoneJson = (await phoneResp.json().catch(() => ({}))) as any;
  console.log("Meta discovery: phone_numbers", { status: phoneResp.status, ok: phoneResp.ok, json: phoneJson });
  if (!phoneResp.ok) {
    const msg =
      typeof phoneJson?.error?.message === "string"
        ? phoneJson.error.message
        : `Meta discovery phone_numbers failed (HTTP ${phoneResp.status})`;
    throw new Error(msg);
  }

  const phoneNumberId = typeof phoneJson?.data?.[0]?.id === "string" ? String(phoneJson.data[0].id) : null;
  const phoneNumber = typeof phoneJson?.data?.[0]?.display_phone_number === "string" ? String(phoneJson.data[0].display_phone_number) : null;
  if (!phoneNumberId) throw new Error("Aucun numéro WhatsApp trouvé. Ajoutez un numéro dans WhatsApp Manager puis réessayez.");

  return { businessId, wabaId, phoneNumberId, phoneNumber };
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
