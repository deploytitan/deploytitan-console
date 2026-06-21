import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";
import { redirect } from "next/navigation";

function buildPostLoginReturnPath(externalAuthId: string | null) {
  if (!externalAuthId) {
    return "/auth/post-login";
  }

  return `/auth/post-login?external_auth_id=${encodeURIComponent(externalAuthId)}`;
}

export const GET = async (request: Request) => {
  const externalAuthId = new URL(request.url).searchParams.get("external_auth_id");
  const auth = await withAuth();

  if (externalAuthId && auth.user) {
    redirect(buildPostLoginReturnPath(externalAuthId));
  }

  const signInUrl = await getSignInUrl({
    redirectUri: getWorkOSRedirectUri(),
    returnTo: buildPostLoginReturnPath(externalAuthId),
  });

  return redirect(signInUrl);
};
