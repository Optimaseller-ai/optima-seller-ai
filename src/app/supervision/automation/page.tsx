import { redirect } from "next/navigation";

/** Automation UI fusionnée dans /supervision — APIs inchangées. */
export default function SupervisionAutomationRedirectPage() {
  redirect("/supervision#equipe");
}
