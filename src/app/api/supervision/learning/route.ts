import { NextResponse } from "next/server";

import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { getBusinessLearningView } from "@/lib/learning/business-learning-engine";

export async function GET() {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;
  if (!gate.userId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const view = await getBusinessLearningView(gate.userId);
  return NextResponse.json(view);
}
