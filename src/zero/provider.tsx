"use client";

/**
 * Zero client factory.
 *
 * Creates a Zero instance with the given auth token, userID, and the
 * platform mutators. Called from ZeroWithAuth whenever the token changes.
 *
 * Per the Zero docs:
 *   - `userID` segregates client-side storage per user
 *   - `auth`   is the Bearer token forwarded to /api/zero/query and /api/zero/mutate
 *   - `context` is passed to query/mutator fns as `ctx` on the client side
 */

import { Zero } from "@rocicorp/zero";
import type { ZeroContext } from "@deploytitan/zero-schema";
import { mutators, schema } from "@deploytitan/zero-schema";
import { ZERO_SERVER } from "../env";
import { logFrontendEvent } from "../lib/frontendTelemetry";

export function createZero(
  token: string | undefined,
  userId: string | undefined,
) {
  if (!ZERO_SERVER) {
    throw new Error(
      "NEXT_PUBLIC_ZERO_SERVER must be set before creating the Zero client.",
    );
  }

  // Zero requires userID whenever auth is set — only pass auth if we have both.
  const hasAuth = token !== null && userId !== null;
  const context: ZeroContext | undefined = userId ? { userId } : undefined;

  logFrontendEvent({
    level: "info",
    message: "zero.client.create",
    context: {
      hasAuth,
      userId,
      cacheUrl: ZERO_SERVER,
    },
  });

  return new Zero({
    userID: userId ?? undefined,
    auth: hasAuth ? token : undefined,
    context,
    cacheURL: ZERO_SERVER,
    schema,
    mutators,
    kvStore: "idb",
  });
}
