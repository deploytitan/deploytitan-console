import type { AuthConfig } from "convex/server";
import {
  getWorkOSUserManagementIssuerUrl,
  getWorkOSUserManagementJwksUrl,
} from "../src/lib/workos";

const userManagementJwks = getWorkOSUserManagementJwksUrl();
if (!userManagementJwks) {
  throw new Error("WORKOS_CLIENT_ID must be set for Convex auth.");
}

const providers: AuthConfig["providers"] = [
  {
    type: "customJwt",
    issuer: getWorkOSUserManagementIssuerUrl(),
    algorithm: "RS256",
    jwks: userManagementJwks,
  },
];

export default {
  providers,
} satisfies AuthConfig;
