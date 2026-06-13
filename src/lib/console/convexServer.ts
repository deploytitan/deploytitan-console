import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

function getConvexUrl(): string {
  const url =
    process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL for Convex.");
  }

  return url;
}

function createAuthedClient(accessToken: string) {
  const client = new ConvexHttpClient(getConvexUrl(), { logger: false });
  client.setAuth(accessToken);
  return client;
}

export async function convexSyncSession(
  accessToken: string,
  args: {
    user: {
      workosUserId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    organization:
      | {
          workosOrgId: string;
          name: string;
        }
      | null;
  },
) {
  return createAuthedClient(accessToken).mutation(api.console.syncSession, args);
}

export async function convexCreateOrganization(
  accessToken: string,
  args: {
    workosOrgId: string;
    name: string;
  },
) {
  return createAuthedClient(accessToken).mutation(
    api.console.createOrganization,
    args,
  );
}
