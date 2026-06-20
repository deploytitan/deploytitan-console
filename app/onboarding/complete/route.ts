import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { api } from "@convex/_generated/api";
import { convexMutation } from "@/lib/console/convexServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { accessToken } = await withAuth({ ensureSignedIn: true });
  const { searchParams } = new URL(request.url);
  const continuationToken = searchParams.get("token");
  const step = searchParams.get("step");

  if (accessToken && continuationToken && step) {
    await convexMutation(accessToken, api.platform.completeBrowserContinuation, {
      continuationToken,
      completedStep: step,
    });
  }

  redirect("/onboarding");
}
