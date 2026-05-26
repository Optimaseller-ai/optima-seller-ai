import { NextResponse } from "next/server";

import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { buildSupervisionControlCenter } from "@/lib/supervision/build-supervision-feed";
import { getSupervisionBusSnapshot } from "@/lib/supervision/supervision-event-bus";

export async function GET() {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;

  const payload = await buildSupervisionControlCenter(gate.userId);
  const bus = getSupervisionBusSnapshot();

  return NextResponse.json({
    ...payload,
    busVersion: bus.version,
  });
}
