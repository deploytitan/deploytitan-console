import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";

const redirectUri = getWorkOSRedirectUri();
console.log("Redirect URI: ", redirectUri);

export default authkitProxy({
  debug: true,
  redirectUri,
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.webp$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.woff2?$|.*\\.ttf$).*)",
  ],
};
