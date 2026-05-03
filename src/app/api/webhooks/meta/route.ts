import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { POST as WhatsAppPost, GET as WhatsAppGet } from "@/app/api/webhooks/whatsapp/route";

// Alias endpoint requested by user:
// - GET /api/webhooks/meta for Meta webhook verification
// - POST /api/webhooks/meta for inbound WhatsApp messages
//
// Internally we reuse the WhatsApp webhook implementation.

export async function GET(req: Request) {
  // Support META_VERIFY_TOKEN as quick-start variable name.
  if (env.META_VERIFY_TOKEN && !env.WHATSAPP_VERIFY_TOKEN) {
    (process.env as any).WHATSAPP_VERIFY_TOKEN = env.META_VERIFY_TOKEN;
  }
  return WhatsAppGet(req);
}

export async function POST(req: Request) {
  // If no per-user connection exists yet, the /whatsapp handler expects to look up by phone_number_id.
  // Keeping this alias for compatibility; real routing is handled in /api/webhooks/whatsapp.
  return WhatsAppPost(req);
}

