import type { AuthConfig } from "convex/server";

// The OAuth app client ID — used for JWKS key lookup
const clientId = process.env.WORKOS_CLIENT_ID;

if (!clientId) {
  throw new Error("WORKOS_CLIENT_ID must be set for Convex auth.");
}

// The user management environment that signs JWTs (the `iss` claim in the token).
// This is a different WorkOS entity from the OAuth app client.
const USER_MANAGEMENT_ISSUER_ID = "client_01KP99QCE9S1WNMVD5H5FHTMQJ";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${USER_MANAGEMENT_ISSUER_ID}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
} satisfies AuthConfig;
