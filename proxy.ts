import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";

export default authkitProxy({
  redirectUri: getWorkOSRedirectUri(),
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/login",
      "/sign-in",
      "/signin",
      "/sign-up",
      "/signup",
      "/register",
    ],
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.webp$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.woff2?$|.*\\.ttf$).*)"],
};
