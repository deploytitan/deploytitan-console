import type { AuthConfig } from "convex/server";

const DEFAULT_USER_MANAGEMENT_ISSUER_ID = "client_01KP99QCE9S1WNMVD5H5FHTMQJ";

function getWorkOSUserManagementIssuerUrl() {
  return `https://api.workos.com/user_management/${DEFAULT_USER_MANAGEMENT_ISSUER_ID}`;
}

function getWorkOSUserManagementJwksUrl() {
  const clientId = process.env.WORKOS_CLIENT_ID ?? "";
  return clientId ? `https://api.workos.com/sso/jwks/${clientId}` : "";
}

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
