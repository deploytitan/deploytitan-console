import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";

export const GET = async () => {
  const { accessToken } = await withAuth({ ensureSignedIn: true });
  if (accessToken) {
    const [, payload] = accessToken.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    console.log("[post-login] JWT claims:", JSON.stringify(claims, null, 2));
  }

  const { organizationId } = await syncAuthenticatedSessionToConvex();

  if (organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  redirect("/onboarding");
};
