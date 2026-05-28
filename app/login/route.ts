import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";
import { redirect } from "next/navigation";

export const GET = async () => {
  const signInUrl = await getSignInUrl({
    redirectUri: getWorkOSRedirectUri(),
    returnTo: "/auth/post-login",
  });

  return redirect(signInUrl);
};
