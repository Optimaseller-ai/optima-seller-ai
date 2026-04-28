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
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
