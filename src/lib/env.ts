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
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,

  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  LEEKPAY_SECRET_KEY: process.env.LEEKPAY_SECRET_KEY,
  LEEKPAY_PUBLIC_KEY: process.env.LEEKPAY_PUBLIC_KEY,
});
