import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { api } from "@convex/_generated/api";
import {
  convexAction,
  convexMutation,
  convexQuery,
  convexSyncSession,
} from "@/lib/console/convexServer";
import {
  getDeployTitanMcpResourceUrl,
  getDeployTitanBaseUrl,
  getVercelConnectUrl,
  getWorkOSAuthKitDomain,
  getWorkOSUserManagementIssuerUrl,
  getWorkOSUserManagementJwksUrl,
} from "@/lib/workos";
import {
  createCheckoutSession,
  createPortalSession,
  getAvailableBillingProviders,
  getBillingReturnUrl,
  getDefaultBillingProvider,
} from "@/lib/billing";
import {
  getHelpArticle,
  listHelpArticles,
  searchHelpArticles,
} from "@/lib/help/search";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type VerifiedMcpSession = {
  accessToken: string;
  claims: JWTPayload;
  protocolVersion: string;
};

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (
    session: VerifiedMcpSession,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
};

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    },
    { status: 200 },
  );
}

function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
}

function getProtocolVersion(request: Request) {
  return request.headers.get("MCP-Protocol-Version") ?? "2025-06-18";
}

function buildProtectedResourceMetadataUrl(request: Request) {
  return `${getRequestOrigin(request)}/.well-known/oauth-protected-resource`;
}

function buildResourceUrl(request: Request) {
  return getDeployTitanMcpResourceUrl(getRequestOrigin(request));
}

function buildWwwAuthenticateHeader(request: Request) {
  return [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${buildProtectedResourceMetadataUrl(request)}"`,
  ].join(", ");
}

function unauthorizedResponse(request: Request, message = "Unauthorized") {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": buildWwwAuthenticateHeader(request),
      },
    },
  );
}

function getStringClaim(payload: JWTPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

async function verifyAccessToken(
  request: Request,
  accessToken: string,
): Promise<JWTPayload> {
  const authKitDomain = getWorkOSAuthKitDomain();
  if (authKitDomain) {
    const jwks = createRemoteJWKSet(new URL(`${authKitDomain}/oauth2/jwks`));
    const result = await jwtVerify(accessToken, jwks, {
      issuer: authKitDomain,
      audience: buildResourceUrl(request),
    });
    return result.payload;
  }

  const userManagementJwks = getWorkOSUserManagementJwksUrl();
  if (!userManagementJwks) {
    throw new Error("WORKOS auth configuration is incomplete.");
  }

  const jwks = createRemoteJWKSet(new URL(userManagementJwks));
  const result = await jwtVerify(accessToken, jwks, {
    issuer: getWorkOSUserManagementIssuerUrl(),
  });
  return result.payload;
}

async function bootstrapActorContext(session: VerifiedMcpSession) {
  const workosUserId =
    getStringClaim(session.claims, ["sub", "user_id"]) ??
    "";
  if (!workosUserId) {
    throw new Error("WorkOS access token is missing the subject claim.");
  }

  const organizationId = getStringClaim(session.claims, [
    "org_id",
    "organization_id",
    "organizationId",
  ]);

  let organization: { workosOrgId: string; name: string } | null = null;
  if (organizationId) {
    try {
      const workosOrganization =
        await getWorkOS().organizations.getOrganization(organizationId);
      organization = {
        workosOrgId: workosOrganization.id,
        name: workosOrganization.name,
      };
    } catch (error) {
      console.error("[mcp] failed to fetch WorkOS organization", error);
    }
  }

  return await convexSyncSession(session.accessToken, {
    user: {
      workosUserId,
      email: getStringClaim(session.claims, ["email"]) ?? null,
      firstName: getStringClaim(session.claims, ["given_name", "first_name"]) ?? null,
      lastName: getStringClaim(session.claims, ["family_name", "last_name"]) ?? null,
    },
    organization,
    defaultWorkosOrgId: organizationId,
  });
}

type ActorOrganization = {
  workosOrgId: string;
  name: string;
};

function getActorOrganizations(actor: {
  organizations?: Array<{ workosOrgId: string; name: string }>;
}) {
  return (actor.organizations ?? []) as ActorOrganization[];
}

function ensureString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function ensureStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value as string[];
}

function ensureApprovers(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("approvers must be an array.");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("approver entries must be objects.");
    }

    const record = item as Record<string, unknown>;
    return {
      name: ensureString(record.name, "approver.name"),
      email:
        typeof record.email === "string" && record.email.length > 0
          ? record.email
          : undefined,
      role:
        typeof record.role === "string" && record.role.length > 0
          ? record.role
          : undefined,
    };
  });
}

function ensureBillingProvider(value: unknown) {
  if (value === "polar" || value === "paddle") {
    return value;
  }
  return getDefaultBillingProvider();
}

const tools: ToolDefinition[] = [
  {
    name: "get_onboarding_guide",
    title: "Get onboarding guide",
    description:
      "Return the step-by-step onboarding guide, current progress, and the next recommended action.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (session) =>
      await convexQuery(session.accessToken, api.platform.getOnboardingGuide, {}),
  },
  {
    name: "get_onboarding_status",
    title: "Get onboarding status",
    description:
      "Return the current actor workspace readiness, organizations, and projects.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (session) =>
      await convexQuery(session.accessToken, api.releaseControl.getOnboardingStatus, {}),
  },
  {
    name: "open_browser_step",
    title: "Open browser step",
    description:
      "Prepare a resumable browser continuation for GitHub, Vercel, Slack, Grafana, or billing steps.",
    inputSchema: {
      type: "object",
      properties: {
        step: { type: "string" },
      },
      required: ["step"],
      additionalProperties: false,
    },
    handler: async (session, params) => {
      const step = ensureString(params.step, "step");
      const continuation = await convexMutation(
        session.accessToken,
        api.platform.updateOnboardingProgress,
        {
          currentStep: step,
          pendingBrowserStep: step,
        },
      );

      const baseUrl = getDeployTitanBaseUrl();
      const continuationToken = continuation.continuationToken;
      const continuationSuffix = continuationToken
        ? `?token=${encodeURIComponent(continuationToken)}`
        : "";

      const browserTargets: Record<string, string> = {
        github: getDeployTitanBaseUrl()
          ? `${getDeployTitanBaseUrl()}/api/diagnostics`
          : "",
        vercel: getVercelConnectUrl()
          ? `${getVercelConnectUrl()}${continuationSuffix}`
          : "",
        slack: `${baseUrl}/onboarding${continuationSuffix}`,
        grafana: `${baseUrl}/onboarding${continuationSuffix}`,
        billing: `${baseUrl}/api/billing/checkout`,
      };

      return {
        step,
        continuationToken,
        browserUrl: browserTargets[step] ?? `${baseUrl}/onboarding${continuationSuffix}`,
      };
    },
  },
  {
    name: "complete_onboarding_step",
    title: "Complete onboarding step",
    description:
      "Mark an onboarding step as complete or move to the next step in the guide.",
    inputSchema: {
      type: "object",
      properties: {
        currentStep: { type: "string" },
        completedStep: { type: "string" },
        notes: { type: "string" },
      },
      required: ["currentStep"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(session.accessToken, api.platform.updateOnboardingProgress, {
        currentStep: ensureString(params.currentStep, "currentStep"),
        completedStep:
          typeof params.completedStep === "string"
            ? params.completedStep
            : undefined,
        notes: typeof params.notes === "string" ? params.notes : undefined,
      }),
  },
  {
    name: "list_organizations",
    title: "List organizations",
    description: "List organizations and the active organization context for the current actor.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (session) =>
      await convexQuery(session.accessToken, api.releaseControl.listOrganizations, {}),
  },
  {
    name: "create_organization",
    title: "Create organization",
    description:
      "Create a WorkOS organization, add the current user as an admin, and sync it into DeployTitan.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: async (session, params) => {
      const name = ensureString(params.name, "name");
      const workosUserId =
        getStringClaim(session.claims, ["sub", "user_id"]) ?? "";
      if (!workosUserId) {
        throw new Error("The current token is missing the user identifier.");
      }

      const organization = await getWorkOS().organizations.createOrganization({
        name,
      });
      await getWorkOS().userManagement.createOrganizationMembership({
        userId: workosUserId,
        organizationId: organization.id,
      });

      await convexSyncSession(session.accessToken, {
        user: {
          workosUserId,
          email: getStringClaim(session.claims, ["email"]) ?? null,
          firstName:
            getStringClaim(session.claims, ["given_name", "first_name"]) ?? null,
          lastName:
            getStringClaim(session.claims, ["family_name", "last_name"]) ?? null,
        },
        organization: {
          workosOrgId: organization.id,
          name: organization.name,
        },
        defaultWorkosOrgId: organization.id,
      });

      return {
        orgId: organization.id,
        name: organization.name,
      };
    },
  },
  {
    name: "create_project",
    title: "Create project",
    description: "Create a DeployTitan project inside the given WorkOS organization.",
    inputSchema: {
      type: "object",
      properties: {
        workosOrgId: { type: "string" },
        name: { type: "string" },
      },
      required: ["workosOrgId", "name"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(session.accessToken, api.console.createProject, {
        workosOrgId: ensureString(params.workosOrgId, "workosOrgId"),
        name: ensureString(params.name, "name"),
      }),
  },
  {
    name: "get_billing_status",
    title: "Get billing status",
    description:
      "Return provider-agnostic organization billing state and active checkout or portal links.",
    inputSchema: {
      type: "object",
      properties: {
        workosOrgId: { type: "string" },
      },
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(session.accessToken, api.platform.getBillingStatus, {
        workosOrgId:
          typeof params.workosOrgId === "string" ? params.workosOrgId : undefined,
      }),
  },
  {
    name: "create_checkout_link",
    title: "Create checkout link",
    description:
      "Create a hosted checkout link for the current organization using Paddle or Polar.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["paddle", "polar"] },
        planId: { type: "string" },
      },
      additionalProperties: false,
    },
    handler: async (session, params) => {
      const actor = await convexQuery(session.accessToken, api.actors.getActorContext, {});
      const organizations = getActorOrganizations(actor);
      const workosOrgId = actor.activeWorkosOrgId ?? organizations[0]?.workosOrgId;
      if (!workosOrgId) {
        throw new Error("No active organization.");
      }

      const organization = organizations.find(
        (entry) => entry.workosOrgId === workosOrgId,
      );
      if (!organization) {
        throw new Error("Organization context is missing.");
      }

      const sessionData = await createCheckoutSession({
        provider: ensureBillingProvider(params.provider),
        organizationWorkosOrgId: workosOrgId,
        organizationName: organization.name,
        customerEmail: actor.user?.email ?? null,
        returnUrl: getBillingReturnUrl("/onboarding"),
        planId:
          typeof params.planId === "string" && params.planId.length > 0
            ? params.planId
            : "starter",
      });

      await convexMutation(session.accessToken, api.platform.upsertBillingAccount, {
        workosOrgId,
        provider: sessionData.provider,
        status: "checkout_pending",
        customerId: sessionData.externalCustomerId ?? undefined,
        subscriptionId: sessionData.externalSubscriptionId ?? undefined,
        planId:
          typeof params.planId === "string" && params.planId.length > 0
            ? params.planId
            : "starter",
        checkoutUrl: sessionData.url,
        metadataJson: JSON.stringify(sessionData.metadata),
      });

      return {
        checkoutUrl: sessionData.url,
        provider: sessionData.provider,
      };
    },
  },
  {
    name: "open_billing_portal",
    title: "Open billing portal",
    description:
      "Create a hosted customer portal link for the current organization billing account.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["paddle", "polar"] },
      },
      additionalProperties: false,
    },
    handler: async (session, params) => {
      const actor = await convexQuery(session.accessToken, api.actors.getActorContext, {});
      const organizations = getActorOrganizations(actor);
      const workosOrgId = actor.activeWorkosOrgId ?? organizations[0]?.workosOrgId;
      if (!workosOrgId) {
        throw new Error("No active organization.");
      }

      const organization = organizations.find(
        (entry) => entry.workosOrgId === workosOrgId,
      );
      if (!organization) {
        throw new Error("Organization context is missing.");
      }

      const sessionData = await createPortalSession({
        provider: ensureBillingProvider(params.provider),
        organizationWorkosOrgId: workosOrgId,
        organizationName: organization.name,
        customerEmail: actor.user?.email ?? null,
        returnUrl: getBillingReturnUrl("/onboarding"),
      });

      await convexMutation(session.accessToken, api.platform.upsertBillingAccount, {
        workosOrgId,
        provider: sessionData.provider,
        status: "active",
        portalUrl: sessionData.url,
        metadataJson: JSON.stringify(sessionData.metadata),
      });

      return {
        portalUrl: sessionData.url,
        provider: sessionData.provider,
      };
    },
  },
  {
    name: "configure_project_integration",
    title: "Configure project integration",
    description:
      "Store GitHub, Slack, or Grafana integration details for a DeployTitan project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPublicId: { type: "string" },
        kind: { type: "string", enum: ["github", "slack", "grafana"] },
        status: { type: "string", enum: ["active", "inactive"] },
        slackIncomingWebhookUrl: { type: "string" },
        slackDefaultChannel: { type: "string" },
        githubToken: { type: "string" },
        githubInstallUrl: { type: "string" },
        grafanaEndpointUrl: { type: "string" },
        grafanaApiToken: { type: "string" },
        grafanaMetricName: { type: "string" },
        grafanaAlertThresholdPercent: { type: "number" },
      },
      required: ["projectPublicId", "kind"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(
        session.accessToken,
        api.releaseControl.configureProjectIntegration,
        {
          projectPublicId: ensureString(params.projectPublicId, "projectPublicId"),
          kind: ensureString(params.kind, "kind") as
            | "github"
            | "slack"
            | "grafana",
          status:
            typeof params.status === "string"
              ? (params.status as "active" | "inactive")
              : undefined,
          slackIncomingWebhookUrl:
            typeof params.slackIncomingWebhookUrl === "string"
              ? params.slackIncomingWebhookUrl
              : undefined,
          slackDefaultChannel:
            typeof params.slackDefaultChannel === "string"
              ? params.slackDefaultChannel
              : undefined,
          githubToken:
            typeof params.githubToken === "string" ? params.githubToken : undefined,
          githubInstallUrl:
            typeof params.githubInstallUrl === "string"
              ? params.githubInstallUrl
              : undefined,
          grafanaEndpointUrl:
            typeof params.grafanaEndpointUrl === "string"
              ? params.grafanaEndpointUrl
              : undefined,
          grafanaApiToken:
            typeof params.grafanaApiToken === "string"
              ? params.grafanaApiToken
              : undefined,
          grafanaMetricName:
            typeof params.grafanaMetricName === "string"
              ? params.grafanaMetricName
              : undefined,
          grafanaAlertThresholdPercent:
            typeof params.grafanaAlertThresholdPercent === "number"
              ? params.grafanaAlertThresholdPercent
              : undefined,
        },
      ),
  },
  {
    name: "search_help",
    title: "Search help",
    description:
      "Search DeployTitan's embedded help content for onboarding, billing, integrations, and troubleshooting guidance.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async (_session, params) => {
      const query = ensureString(params.query, "query");
      return searchHelpArticles(query).map((article) => ({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        keywords: article.keywords,
      }));
    },
  },
  {
    name: "answer_product_question",
    title: "Answer product question",
    description:
      "Answer a DeployTitan setup or product question using the embedded help corpus.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
      additionalProperties: false,
    },
    handler: async (_session, params) => {
      const question = ensureString(params.question, "question");
      const matches = searchHelpArticles(question).slice(0, 3);
      return {
        question,
        matches: matches.map((article) => ({
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          body: article.body,
        })),
      };
    },
  },
  {
    name: "search_pull_requests",
    title: "Search pull requests",
    description:
      "Search pull requests by organization or project, returning structured PR metadata for release selection.",
    inputSchema: {
      type: "object",
      properties: {
        workosOrgId: { type: "string" },
        projectPublicId: { type: "string" },
        queryText: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(session.accessToken, api.releaseControl.searchPullRequests, {
        workosOrgId:
          typeof params.workosOrgId === "string" ? params.workosOrgId : undefined,
        projectPublicId:
          typeof params.projectPublicId === "string"
            ? params.projectPublicId
            : undefined,
        queryText:
          typeof params.queryText === "string" ? params.queryText : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      }),
  },
  {
    name: "create_release_packet",
    title: "Create release packet",
    description:
      "Create a release packet from selected pull requests and release metadata.",
    inputSchema: {
      type: "object",
      properties: {
        projectPublicId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        targetEnvironment: { type: "string" },
        successMetric: { type: "string" },
        shipPlan: { type: "string" },
        outcome: { type: "string" },
        approvalSummary: { type: "string" },
        riskSummary: { type: "string" },
        monitorWindowMinutes: { type: "number" },
        pullRequestPublicIds: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["projectPublicId", "name", "pullRequestPublicIds"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(session.accessToken, api.releaseControl.createReleasePacket, {
        projectPublicId: ensureString(params.projectPublicId, "projectPublicId"),
        name: ensureString(params.name, "name"),
        description:
          typeof params.description === "string" ? params.description : undefined,
        targetEnvironment:
          typeof params.targetEnvironment === "string"
            ? params.targetEnvironment
            : undefined,
        successMetric:
          typeof params.successMetric === "string"
            ? params.successMetric
            : undefined,
        shipPlan:
          typeof params.shipPlan === "string" ? params.shipPlan : undefined,
        outcome:
          typeof params.outcome === "string" ? params.outcome : undefined,
        approvalSummary:
          typeof params.approvalSummary === "string"
            ? params.approvalSummary
            : undefined,
        riskSummary:
          typeof params.riskSummary === "string" ? params.riskSummary : undefined,
        monitorWindowMinutes:
          typeof params.monitorWindowMinutes === "number"
            ? params.monitorWindowMinutes
            : undefined,
        pullRequestPublicIds: ensureStringArray(
          params.pullRequestPublicIds,
          "pullRequestPublicIds",
        ),
      }),
  },
  {
    name: "update_release_packet",
    title: "Update release packet",
    description: "Update release packet details, lifecycle state, and operating metadata.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        targetEnvironment: { type: "string" },
        successMetric: { type: "string" },
        shipPlan: { type: "string" },
        outcome: { type: "string" },
        approvalSummary: { type: "string" },
        riskSummary: { type: "string" },
        monitorWindowMinutes: { type: "number" },
        status: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(session.accessToken, api.releaseControl.updateReleasePacket, {
        releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
        name: typeof params.name === "string" ? params.name : undefined,
        description:
          typeof params.description === "string" ? params.description : undefined,
        targetEnvironment:
          typeof params.targetEnvironment === "string"
            ? params.targetEnvironment
            : undefined,
        successMetric:
          typeof params.successMetric === "string"
            ? params.successMetric
            : undefined,
        shipPlan:
          typeof params.shipPlan === "string" ? params.shipPlan : undefined,
        outcome:
          typeof params.outcome === "string" ? params.outcome : undefined,
        approvalSummary:
          typeof params.approvalSummary === "string"
            ? params.approvalSummary
            : undefined,
        riskSummary:
          typeof params.riskSummary === "string" ? params.riskSummary : undefined,
        monitorWindowMinutes:
          typeof params.monitorWindowMinutes === "number"
            ? params.monitorWindowMinutes
            : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
      }),
  },
  {
    name: "get_release_summary",
    title: "Get release summary",
    description:
      "Fetch a structured release summary suitable for agent-side risk and stakeholder summarization.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(session.accessToken, api.releaseControl.getReleaseSummary, {
        releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
      }),
  },
  {
    name: "get_release_timeline",
    title: "Get release timeline",
    description: "Fetch the structured timeline of release events and workflow transitions.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(session.accessToken, api.releaseControl.getReleaseTimeline, {
        releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
      }),
  },
  {
    name: "request_release_approvals",
    title: "Request release approvals",
    description:
      "Queue Slack-first approval requests for a release packet and move it into the approval phase.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
        approvers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["releasePublicId", "approvers"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(
        session.accessToken,
        api.releaseControl.requestReleaseApprovals,
        {
          releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
          approvers: ensureApprovers(params.approvers),
        },
      ),
  },
  {
    name: "get_release_approval_status",
    title: "Get release approval status",
    description: "Inspect approval progress, pending stakeholders, and blockers for a release.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(
        session.accessToken,
        api.releaseControl.getReleaseApprovalStatus,
        {
          releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
        },
      ),
  },
  {
    name: "send_release_approval_reminders",
    title: "Send release approval reminders",
    description: "Queue reminder notifications for all still-pending release approvers.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(
        session.accessToken,
        api.releaseControl.sendReleaseApprovalReminders,
        {
          releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
        },
      ),
  },
  {
    name: "merge_release_pull_requests",
    title: "Merge release pull requests",
    description:
      "Execute a GitHub-backed merge run for the pull requests attached to a release packet.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
        mergeMethod: {
          type: "string",
          enum: ["merge", "squash", "rebase"],
        },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexAction(session.accessToken, api.releaseControl.mergeReleasePullRequests, {
        releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
        mergeMethod:
          typeof params.mergeMethod === "string"
            ? (params.mergeMethod as "merge" | "squash" | "rebase")
            : undefined,
      }),
  },
  {
    name: "start_release_monitoring",
    title: "Start release monitoring",
    description:
      "Start a Grafana-first monitoring session for the release and persist structured health snapshots.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
        metricName: { type: "string" },
        monitorWindowMinutes: { type: "number" },
        thresholdPercent: { type: "number" },
        pollIntervalMinutes: { type: "number" },
      },
      required: ["releasePublicId", "metricName"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexMutation(
        session.accessToken,
        api.releaseControl.startReleaseMonitoring,
        {
          releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
          metricName: ensureString(params.metricName, "metricName"),
          monitorWindowMinutes:
            typeof params.monitorWindowMinutes === "number"
              ? params.monitorWindowMinutes
              : undefined,
          thresholdPercent:
            typeof params.thresholdPercent === "number"
              ? params.thresholdPercent
              : undefined,
          pollIntervalMinutes:
            typeof params.pollIntervalMinutes === "number"
              ? params.pollIntervalMinutes
              : undefined,
        },
      ),
  },
  {
    name: "get_release_monitoring_status",
    title: "Get release monitoring status",
    description: "Fetch the current monitoring sessions and health summary for a release.",
    inputSchema: {
      type: "object",
      properties: {
        releasePublicId: { type: "string" },
      },
      required: ["releasePublicId"],
      additionalProperties: false,
    },
    handler: async (session, params) =>
      await convexQuery(
        session.accessToken,
        api.releaseControl.getReleaseMonitoringStatus,
        {
          releasePublicId: ensureString(params.releasePublicId, "releasePublicId"),
        },
      ),
  },
];

async function readResource(
  session: VerifiedMcpSession,
  uri: string,
) {
  if (uri.startsWith("deploytitan://help/")) {
    const slug = uri.replace("deploytitan://help/", "");
    const article = getHelpArticle(slug);
    if (!article) {
      throw new Error(`Unknown help article: ${slug}`);
    }
    return article;
  }

  if (uri === "deploytitan://actor/current") {
    return await convexQuery(session.accessToken, api.actors.getActorContext, {});
  }

  if (uri.startsWith("deploytitan://org/") && uri.endsWith("/dashboard")) {
    const workosOrgId = uri
      .replace("deploytitan://org/", "")
      .replace("/dashboard", "");
    return await convexQuery(session.accessToken, api.console.getOrgDashboard, {
      workosOrgId,
    });
  }

  if (uri.startsWith("deploytitan://release/") && uri.endsWith("/summary")) {
    const releasePublicId = uri
      .replace("deploytitan://release/", "")
      .replace("/summary", "");
    return await convexQuery(session.accessToken, api.releaseControl.getReleaseSummary, {
      releasePublicId,
    });
  }

  if (uri.startsWith("deploytitan://release/") && uri.endsWith("/timeline")) {
    const releasePublicId = uri
      .replace("deploytitan://release/", "")
      .replace("/timeline", "");
    return await convexQuery(session.accessToken, api.releaseControl.getReleaseTimeline, {
      releasePublicId,
    });
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
}

async function listResources(session: VerifiedMcpSession) {
  const actor = await convexQuery(session.accessToken, api.actors.getActorContext, {});
  const resources = [
    {
      uri: "deploytitan://actor/current",
      name: "Current actor context",
      description: "Organizations and active context for the authenticated user.",
      mimeType: "application/json",
    },
  ];

  for (const article of listHelpArticles()) {
    resources.push({
      uri: `deploytitan://help/${article.slug}`,
      name: article.title,
      description: article.summary,
      mimeType: "application/json",
    });
  }

  for (const organization of actor.organizations) {
    resources.push({
      uri: `deploytitan://org/${organization.workosOrgId}/dashboard`,
      name: `${organization.name} dashboard`,
      description: "Projects and top-level organization dashboard data.",
      mimeType: "application/json",
    });
  }

  return resources;
}

export async function handleMcpRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return unauthorizedResponse(request);
  }

  const accessToken = authorization.slice("Bearer ".length);
  let claims: JWTPayload;
  try {
    claims = await verifyAccessToken(request, accessToken);
  } catch (error) {
    console.error("[mcp] token verification failed", error);
    return unauthorizedResponse(request, "Invalid or expired bearer token.");
  }

  const session: VerifiedMcpSession = {
    accessToken,
    claims,
    protocolVersion: getProtocolVersion(request),
  };

  try {
    await bootstrapActorContext(session);
  } catch (error) {
    console.error("[mcp] actor bootstrap failed", error);
    return new Response(
      JSON.stringify({
        error: "Failed to bootstrap the authenticated actor.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let payload: JsonRpcRequest;
  try {
    payload = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON-RPC payload.");
  }

  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(payload.id ?? null, -32600, "Invalid JSON-RPC request.");
  }

  if (payload.method === "initialize") {
    return jsonRpcResult(payload.id ?? null, {
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: "deploytitan-mcp",
        version: "0.1.0",
        description:
          "AI-native release tracking and guided onboarding for legacy delivery stacks.",
      },
    });
  }

  if (payload.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (payload.method === "ping") {
    return jsonRpcResult(payload.id ?? null, {});
  }

  if (payload.method === "tools/list") {
    return jsonRpcResult(payload.id ?? null, {
      tools: tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }

  if (payload.method === "tools/call") {
    const name = typeof payload.params?.name === "string" ? payload.params.name : "";
    const argumentsValue =
      payload.params && typeof payload.params.arguments === "object"
        ? (payload.params.arguments as Record<string, unknown>)
        : {};
    const tool = tools.find((entry) => entry.name === name);
    if (!tool) {
      return jsonRpcError(payload.id ?? null, -32601, `Unknown tool: ${name}`);
    }

    try {
      const result = await tool.handler(session, argumentsValue);
      return jsonRpcResult(payload.id ?? null, {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
        isError: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tool execution failed.";
      return jsonRpcResult(payload.id ?? null, {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
        structuredContent: {
          error: message,
        },
        isError: true,
      });
    }
  }

  if (payload.method === "resources/list") {
    const resources = await listResources(session);
    return jsonRpcResult(payload.id ?? null, {
      resources,
    });
  }

  if (payload.method === "resources/read") {
    const uri = typeof payload.params?.uri === "string" ? payload.params.uri : "";
    try {
      const resource = await readResource(session, uri);
      return jsonRpcResult(payload.id ?? null, {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(resource, null, 2),
          },
        ],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read resource.";
      return jsonRpcError(payload.id ?? null, -32001, message);
    }
  }

  return jsonRpcError(payload.id ?? null, -32601, `Method not found: ${payload.method}`);
}
