import { notFound } from "next/navigation";
import { createAdminClientSafe } from "@/lib/supabase/admin";
import ChatClient from "./chat-client";

export default async function PublicChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clean = String(slug ?? "").trim();
  if (!clean) notFound();

  const admin = createAdminClientSafe();
  if (!admin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold text-[var(--brand-navy)]">Chat</h1>
        <p className="mt-2 text-sm text-[var(--brand-navy)]/65">
          Le chat public nécessite la variable `SUPABASE_SERVICE_ROLE_KEY`.
        </p>
      </div>
    );
  }

  const { data: agent } = await admin.from("agents").select("id,name,slug,is_active").eq("slug", clean).maybeSingle();
  if (!agent?.id || !agent.is_active) notFound();

  return <ChatClient slug={clean} agentName={agent.name ?? "Assistant"} />;
}

