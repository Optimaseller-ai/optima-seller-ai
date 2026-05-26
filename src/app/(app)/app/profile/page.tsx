import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";
import {
  loadBusinessKnowledgeProfile,
  profileRowToIdentity,
} from "@/lib/business-knowledge/profile/business-knowledge-profile";
import type { ProfileRow } from "@/lib/data/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/app/profile");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id,full_name,business_name,business_type,goal,country,city,contact_phone,offer,email,created_at,updated_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  const profile = (profileRow as ProfileRow | null) ?? null;
  const bundle = await loadBusinessKnowledgeProfile(supabase, auth.user.id, profile);

  return (
    <ProfileClient
      knowledgeIdentity={profileRowToIdentity(profile)}
      knowledgeSettings={bundle.settings}
      knowledgeFaq={bundle.faqEntries}
    />
  );
}
