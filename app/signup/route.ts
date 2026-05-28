import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";
import { redirect } from "next/navigation";

export const GET = async () => {
  const signUpUrl = await getSignUpUrl({
    redirectUri: getWorkOSRedirectUri(),
    returnTo: "/auth/post-login",
  });

  return redirect(signUpUrl);
};
