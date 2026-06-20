import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  isInstallationCreatedAction,
  isPullRequestCreatedAction,
  parseInstallationWebhookEvent,
  parsePullRequestWebhookEvent,
} from "./githubWebhook";
import { Webhooks } from "@octokit/webhooks";

const http = httpRouter();

async function verifyGitHubSignature(
  secret: string,
  body: object,
  signature: string,
): Promise<boolean> {
  const webhooks = new Webhooks({
    secret,
  });

  return await webhooks.verify(body.toString(), signature);
}

http.route({
  path: "/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const event = req.headers.get("x-github-event") ?? "";
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const body: object = await req.json();
    console.log("Received GitHub webhook:", { event, signature, body });

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    // if (secret) {
    //   if (!signature) {
    //     return new Response("Missing signature", { status: 401 });
    //   }
    //
    //   const valid = await verifyGitHubSignature(secret, body, signature);
    //   if (!valid) {
    //     return new Response("Invalid signature", { status: 401 });
    //   }
    // }

    if (event === "ping") {
      return new Response("pong", { status: 200 });
    }

    try {
      if (event === "pull_request") {
        const pullRequestEvent = parsePullRequestWebhookEvent(body);

        if (!isPullRequestCreatedAction(pullRequestEvent.action)) {
          return new Response("Ignored pull request action", { status: 202 });
        }

        await ctx.runMutation(
          internal.github.processPullRequestEvent,
          pullRequestEvent,
        );
        return new Response("Processed pull request.created webhook", {
          status: 200,
        });
      }

      if (event === "installation") {
        const installationEvent = parseInstallationWebhookEvent(body);

        if (!isInstallationCreatedAction(installationEvent.action)) {
          return new Response("Ignored installation action", { status: 202 });
        }

        await ctx.runMutation(
          internal.github.processInstallationEvent,
          installationEvent,
        );
        return new Response("Processed installation.created webhook", {
          status: 200,
        });
      }

      return new Response("Ignored event", { status: 202 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid webhook payload";
      return new Response(message, { status: 400 });
    }
  }),
});

export default http;
