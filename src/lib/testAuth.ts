import { SignJWT } from "jose";
import { sealData } from "../../node_modules/.pnpm/iron-session@8.0.4/node_modules/iron-session/dist/index.js";

export const SMOKE_AUTH_COOKIE = "deploytitan-smoke-auth";

function createFakeAccessToken() {
  const secret = new TextEncoder().encode(process.env.WORKOS_COOKIE_PASSWORD);
  return new SignJWT({
    sid: "sid_smoke",
    sub: "user_smoke",
    org_id: "org_smoke",
    email: "smoke@deploytitan.local",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("urn:deploytitan:smoke")
    .setExpirationTime("2h")
    .sign(secret);
}

export async function createSmokeAuthSession() {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be configured for smoke auth.");
  }

  return await sealData(
    {
      accessToken: await createFakeAccessToken(),
      refreshToken: "refresh_smoke",
      user: {
        id: "user_smoke",
        email: "smoke@deploytitan.local",
        firstName: "Smoke",
        lastName: "Test",
      },
    },
    {
      password,
      ttl: 0,
    },
  );
}

export function isSmokeAuthEnabled() {
  return process.env.DEPLOYTITAN_ENABLE_TEST_AUTH === "1";
}
