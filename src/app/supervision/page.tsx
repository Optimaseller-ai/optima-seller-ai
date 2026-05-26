import type { Metadata } from "next";

import { SupervisionControlCenter } from "@/components/supervision/supervision-control-center";

export const metadata: Metadata = {
  title: "Centre de contrôle | Optima",
  description: "Supervision temps réel des agents commerciaux Optima Seller AI.",
};

export default function SupervisionPage() {
  return <SupervisionControlCenter />;
}
