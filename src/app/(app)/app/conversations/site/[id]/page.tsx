import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteConversationClient from "./site-conversation-client";

export default async function SiteConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=/app/conversations/site/${id}`);

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") redirect("/pricing");

  const { data: conv } = await supabase
    .from("conversations")
    .select("id,user_id,visitor_id,live_mode,created_at,updated_at")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!conv?.id) notFound();

  const { data: msgs } = await supabase
    .from("conversation_messages")
    .select("id,sender,content,created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(500);

  return <SiteConversationClient conversation={conv as any} initialMessages={(msgs ?? []) as any} />;
}

