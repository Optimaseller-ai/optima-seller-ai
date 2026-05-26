"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { CommercialAgentPublic } from "@/lib/chat/commercial-agents";
import { isPreChatComplete } from "@/lib/prospect/pre-chat/storage";
import ChatClient from "./chat-client";
import { PreChatExperience } from "./pre-chat-experience";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "optima_chat_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing && existing.length >= 8) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

type ChatShellProps = {
  slug: string;
  agentId: string;
  agentName: string;
  lockedPersona?: CommercialAgentPublic | null;
};

export function ChatShell({ slug, agentId, agentName, lockedPersona }: ChatShellProps) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionId = useMemo(() => (mounted ? getOrCreateSessionId() : ""), [mounted]);

  useEffect(() => {
    setMounted(true);
    if (isPreChatComplete(slug)) setReady(true);
  }, [slug]);

  if (!mounted) {
    return (
      <motion.div className="min-h-[100dvh] bg-[#f4f6f9]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
    );
  }

  if (!ready) {
    return (
      <PreChatExperience
        slug={slug}
        agentId={agentId}
        sessionId={sessionId}
        agentName={agentName}
        lockedPersona={lockedPersona}
        onComplete={() => setReady(true)}
      />
    );
  }

  return <ChatClient slug={slug} agentName={agentName} lockedPersona={lockedPersona} />;
}
