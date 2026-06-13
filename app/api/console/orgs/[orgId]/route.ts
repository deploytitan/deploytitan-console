import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexQuery } from "@/lib/console/convexServer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { orgId } = await context.params;

  const data = await convexQuery("console:getOrgDashboard", {
    workosOrgId: orgId,
  });

  return NextResponse.json(data);
}
