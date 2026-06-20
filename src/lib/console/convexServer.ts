import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";

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
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    };
    organization:
      | {
          workosOrgId: string;
          name: string;
        }
      | null;
    defaultWorkosOrgId?: string | null;
  },
) {
  return createAuthedClient(accessToken).mutation(api.actors.bootstrapActorContext, {
    ...args,
    defaultWorkosOrgId: args.defaultWorkosOrgId ?? args.organization?.workosOrgId ?? null,
  });
}

export async function convexQuery<
  TRef extends FunctionReference<"query", "public", any, any>,
>(
  accessToken: string,
  ref: TRef,
  args: TRef["_args"],
) {
  return createAuthedClient(accessToken).query(ref, args);
}

export async function convexMutation<
  TRef extends FunctionReference<"mutation", "public", any, any>,
>(
  accessToken: string,
  ref: TRef,
  args: TRef["_args"],
) {
  return createAuthedClient(accessToken).mutation(ref, args);
}

export async function convexAction<
  TRef extends FunctionReference<"action", "public", any, any>,
>(
  accessToken: string,
  ref: TRef,
  args: TRef["_args"],
) {
  return createAuthedClient(accessToken).action(ref, args);
}
