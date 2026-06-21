import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { completeStandaloneWorkOSLogin } from "@/lib/workosStandaloneConnect";

export const GET = async (request: Request) => {
  const { accessToken, user } = await withAuth({ ensureSignedIn: true });
  if (accessToken) {
    const [, payload] = accessToken.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    console.log("[post-login] JWT claims:", JSON.stringify(claims, null, 2));
  }

  const externalAuthId = new URL(request.url).searchParams.get("external_auth_id");

  if (externalAuthId) {
    try {
      const redirectUri = await completeStandaloneWorkOSLogin({
        externalAuthId,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
        },
      });

      redirect(redirectUri);
    } catch (error) {
      console.error("[post-login] standalone connect completion failed", error);
      redirect("/");
    }
  }

  const { organizationId } = await syncAuthenticatedSessionToConvex();

  if (organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  redirect("/onboarding");
};
