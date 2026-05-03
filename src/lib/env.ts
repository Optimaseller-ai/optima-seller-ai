import { z } from "zod";

const optionalTrimmed = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().optional());

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalTrimmed.pipe(z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),
  NEXT_PUBLIC_SITE_URL: optionalTrimmed.pipe(z.string().url().optional()),

  SUPABASE_SERVICE_ROLE_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),

  LEEKPAY_SECRET_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),
  LEEKPAY_PUBLIC_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),

  // WhatsApp Cloud API (Meta)
  WHATSAPP_VERIFY_TOKEN: optionalTrimmed.pipe(z.string().min(1).optional()),
  WHATSAPP_APP_SECRET: optionalTrimmed.pipe(z.string().min(1).optional()),
  WHATSAPP_TOKEN_ENC_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),

  // Meta OAuth / Embedded Signup
  META_APP_ID: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_APP_SECRET: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_CONFIG_ID: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_OAUTH_STATE_SECRET: optionalTrimmed.pipe(z.string().min(1).optional()),

  // Back-compat / quick-start single-tenant envs
  META_ACCESS_TOKEN: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_PHONE_NUMBER_ID: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_WABA_ID: optionalTrimmed.pipe(z.string().min(1).optional()),
  META_VERIFY_TOKEN: optionalTrimmed.pipe(z.string().min(1).optional()),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,

  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  LEEKPAY_SECRET_KEY: process.env.LEEKPAY_SECRET_KEY,
  LEEKPAY_PUBLIC_KEY: process.env.LEEKPAY_PUBLIC_KEY,

  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_TOKEN_ENC_KEY: process.env.WHATSAPP_TOKEN_ENC_KEY,

  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_CONFIG_ID: process.env.META_CONFIG_ID,
  META_OAUTH_STATE_SECRET: process.env.META_OAUTH_STATE_SECRET,

  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID,
  META_WABA_ID: process.env.META_WABA_ID,
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
});
