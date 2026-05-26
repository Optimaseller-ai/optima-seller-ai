import { redirect } from "next/navigation";

/** Redirige vers le centre de contrôle unifié. */
export default function AgentControlPage() {
  redirect("/supervision");
}
