import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

function getConvexUrl() {
  return process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let payload: Record<string, unknown>;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string") {
      return new Response("Missing Slack payload.", { status: 400 });
    }
    payload = JSON.parse(rawPayload) as Record<string, unknown>;
  } else {
    payload = (await request.json()) as Record<string, unknown>;
  }

  const actions = Array.isArray(payload.actions)
    ? (payload.actions as Array<Record<string, unknown>>)
    : [];
  const firstAction = actions[0];
  if (!firstAction) {
    return new Response("Missing Slack action.", { status: 400 });
  }

  const actionId = typeof firstAction.action_id === "string" ? firstAction.action_id : "";
  const actionToken = typeof firstAction.value === "string" ? firstAction.value : "";
  if (!actionToken) {
    return new Response("Missing action token.", { status: 400 });
  }

  const user = payload.user && typeof payload.user === "object"
    ? (payload.user as Record<string, unknown>)
    : {};

  const client = new ConvexHttpClient(getConvexUrl(), { logger: false });
  const result = await client.mutation(api.releaseControl.resolveReleaseApprovalByToken, {
    actionToken,
    decision: actionId === "release_reject" ? "rejected" : "approved",
    slackUserId: typeof user.id === "string" ? user.id : undefined,
    slackDisplayName:
      typeof user.name === "string"
        ? user.name
        : typeof user.username === "string"
          ? user.username
          : undefined,
    comment: undefined,
  });

  return Response.json({
    text:
      result.duplicate
        ? "This approval action was already processed."
        : "DeployTitan recorded your release decision.",
    replace_original: false,
  });
}
