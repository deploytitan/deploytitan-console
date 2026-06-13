import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

function getConvexUrl(): string {
  const url =
    process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

  if (!url) {
    throw new Error(
      "Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before calling the Convex-backed console API.",
    );
  }

  return url;
}

function getAdminToken(): string {
  const token =
    process.env.CONVEX_DEPLOY_KEY ?? process.env.CONVEX_ADMIN_KEY ?? "";

  if (!token) {
    throw new Error(
      "Set CONVEX_DEPLOY_KEY or CONVEX_ADMIN_KEY so Next.js can call internal Convex functions.",
    );
  }

  return token;
}

function createAdminClient(): ConvexHttpClient {
  const client = new ConvexHttpClient(getConvexUrl(), { logger: false });
  (client as ConvexHttpClient & { setAdminAuth(token: string): void }).setAdminAuth(
    getAdminToken(),
  );
  return client;
}

export async function convexQuery<TArgs extends Record<string, unknown>, TResult>(
  name: string,
  args: TArgs,
): Promise<TResult> {
  const client = createAdminClient();
  return client.query(
    makeFunctionReference<"query", TArgs, TResult>(name),
    args as never,
  );
}

export async function convexMutation<
  TArgs extends Record<string, unknown>,
  TResult,
>(name: string, args: TArgs): Promise<TResult> {
  const client = createAdminClient();
  return client.mutation(
    makeFunctionReference<"mutation", TArgs, TResult>(name),
    args as never,
  );
}
