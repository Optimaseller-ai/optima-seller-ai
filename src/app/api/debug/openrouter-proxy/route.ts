import { NextResponse } from "next/server";
import { resolveOpenRouterProxyConfig } from "@/lib/ai/openrouter-proxy-config";

export const runtime = "nodejs";

/**
 * Audit endpoint — vérifie si Vercel enverra OpenRouter via Railway.
 * GET /api/debug/openrouter-proxy
 */
export async function GET() {
  const cfg = resolveOpenRouterProxyConfig();
  const urlHost = cfg.backendUrl
    ? (() => {
        try {
          return new URL(cfg.backendUrl).host;
        } catch {
          return "invalid_url";
        }
      })()
    : null;

  return NextResponse.json({
    backendEnabled: cfg.backendEnabled,
    mode: cfg.mode,
    backendHost: urlHost,
    hasBackendUrl: cfg.hasBackendUrl,
    hasBackendSecret: cfg.hasBackendSecret,
    secretLength: cfg.secretLength,
    hasLocalOpenRouterKey: cfg.hasLocalOpenRouterKey,
    disableReasons: cfg.disableReasons,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    expectedRailwayPaths: ["/v1/llm/chat", "/v1/llm/embed"],
  });
}
