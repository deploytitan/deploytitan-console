import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type ConvexCtx = MutationCtx | QueryCtx;

function now() {
  return Date.now();
}

function createContinuationToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function getGithubAppInstallUrl() {
  const explicit = process.env.GITHUB_APP_INSTALL_URL ?? "";
  if (explicit) {
    return explicit;
  }

  const slug = process.env.GITHUB_APP_SLUG ?? "";
  return slug ? `https://github.com/apps/${slug}/installations/new` : "";
}

async function getProjectByPublicId(
  ctx: ConvexCtx,
  organizationId: Id<"organizations">,
  publicId: string,
) {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
    .unique();

  if (!project || project.orgId !== organizationId) {
    return null;
  }

  return project;
}

async function getViewerByTokenIdentifier(
  ctx: ConvexCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  const authIdentity = await ctx.db
    .query("userAuthIdentities")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();

  if (authIdentity) {
    return await ctx.db.get(authIdentity.userId);
  }

  return await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

async function requireViewer(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized.");
  }

  const viewer = await getViewerByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!viewer) {
    throw new Error("Viewer is not provisioned.");
  }

  return { identity, viewer };
}

async function getOrganizationByWorkosOrgId(ctx: ConvexCtx, workosOrgId: string) {
  return await ctx.db
    .query("organizations")
    .withIndex("by_workos_org_id", (q) => q.eq("workosOrgId", workosOrgId))
    .unique();
}

async function getProjectIntegrations(ctx: ConvexCtx, projectId: Id<"projects">) {
  return await ctx.db
    .query("projectIntegrations")
    .withIndex("by_project_id", (q) => q.eq("projectId", projectId))
    .take(20);
}

async function getOrCreateOnboardingState(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId?: Id<"organizations">,
) {
  const existing = await ctx.db
    .query("onboardingStates")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (existing) {
    return existing;
  }

  const id = await ctx.db.insert("onboardingStates", {
    userId,
    organizationId,
    status: "not_started",
    currentStep: "auth",
    completedSteps: [],
    updatedAt: now(),
    createdAt: now(),
  });

  return (await ctx.db.get(id))!;
}

function uniqueSteps(steps: string[]) {
  return [...new Set(steps)];
}

export const getBillingStatus = query({
  args: {
    workosOrgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const workosOrgId = args.workosOrgId ?? viewer.defaultWorkosOrgId ?? null;
    if (!workosOrgId) {
      return {
        organization: null,
        accounts: [],
        primaryAccount: null,
      };
    }

    const organization = await getOrganizationByWorkosOrgId(ctx, workosOrgId);
    if (!organization) {
      return {
        organization: null,
        accounts: [],
        primaryAccount: null,
      };
    }

    const accounts = await ctx.db
      .query("organizationBillingAccounts")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organization._id))
      .take(20);

    return {
      organization: {
        workosOrgId: organization.workosOrgId,
        name: organization.name,
        allocatedPlanId: organization.allocatedPlanId ?? null,
      },
      accounts: accounts.map((account) => ({
        provider: account.provider,
        status: account.status,
        planId: account.planId ?? null,
        customerId: account.customerId ?? null,
        subscriptionId: account.subscriptionId ?? null,
        checkoutUrl: account.checkoutUrl ?? null,
        portalUrl: account.portalUrl ?? null,
        currentPeriodEndsAt: account.currentPeriodEndsAt ?? null,
      })),
      primaryAccount:
        accounts.find((account) => account.provider === "paddle") ?? accounts[0] ?? null,
    };
  },
});

export const upsertBillingAccount = mutation({
  args: {
    workosOrgId: v.string(),
    provider: v.union(v.literal("paddle"), v.literal("polar")),
    status: v.union(
      v.literal("unconfigured"),
      v.literal("checkout_pending"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled"),
      v.literal("incomplete"),
    ),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    planId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    portalUrl: v.optional(v.string()),
    currentPeriodEndsAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!organization) {
      throw new Error("Organization not found.");
    }

    const existing = await ctx.db
      .query("organizationBillingAccounts")
      .withIndex("by_organization_id_and_provider", (q) =>
        q.eq("organizationId", organization._id).eq("provider", args.provider),
      )
      .unique();

    const timestamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        customerId: args.customerId ?? existing.customerId,
        subscriptionId: args.subscriptionId ?? existing.subscriptionId,
        planId: args.planId ?? existing.planId,
        checkoutUrl: args.checkoutUrl ?? existing.checkoutUrl,
        portalUrl: args.portalUrl ?? existing.portalUrl,
        currentPeriodEndsAt: args.currentPeriodEndsAt ?? existing.currentPeriodEndsAt,
        metadataJson: args.metadataJson ?? existing.metadataJson,
        lastCheckoutAt: args.checkoutUrl ? timestamp : existing.lastCheckoutAt,
        updatedAt: timestamp,
      });
      return (await ctx.db.get(existing._id))!;
    }

    const id = await ctx.db.insert("organizationBillingAccounts", {
      organizationId: organization._id,
      provider: args.provider,
      status: args.status,
      customerId: args.customerId,
      subscriptionId: args.subscriptionId,
      planId: args.planId,
      checkoutUrl: args.checkoutUrl,
      portalUrl: args.portalUrl,
      currentPeriodEndsAt: args.currentPeriodEndsAt,
      metadataJson: args.metadataJson,
      lastCheckoutAt: args.checkoutUrl ? timestamp : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return (await ctx.db.get(id))!;
  },
});

export const recordBillingWebhookEvent = mutation({
  args: {
    workosOrgId: v.string(),
    provider: v.union(v.literal("paddle"), v.literal("polar")),
    kind: v.string(),
    externalId: v.optional(v.string()),
    payloadJson: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!organization) {
      throw new Error("Organization not found.");
    }

    await ctx.db.insert("billingEvents", {
      organizationId: organization._id,
      provider: args.provider,
      kind: args.kind,
      externalId: args.externalId,
      payloadJson: args.payloadJson,
      processedAt: now(),
    });

    return null;
  },
});

export const getOnboardingGuide = query({
  args: {},
  handler: async (ctx) => {
    const { viewer } = await requireViewer(ctx);
    const orgId = viewer.defaultWorkosOrgId ?? null;
    const organization = orgId
      ? await getOrganizationByWorkosOrgId(ctx, orgId)
      : null;
    const projects = organization
      ? await ctx.db
          .query("projects")
          .withIndex("by_org_id", (q) => q.eq("orgId", organization._id))
          .take(20)
      : [];

    const integrations =
      projects.length > 0
        ? await getProjectIntegrations(ctx, projects[0]._id)
        : [];

    const billingAccounts =
      organization
        ? await ctx.db
            .query("organizationBillingAccounts")
            .withIndex("by_organization_id", (q) => q.eq("organizationId", organization._id))
            .take(20)
        : [];

    const hasGithub = integrations.some(
      (integration) => integration.kind === "github" && integration.status === "active",
    );
    const hasSlack = integrations.some(
      (integration) => integration.kind === "slack" && integration.status === "active",
    );
    const hasGrafana = integrations.some(
      (integration) => integration.kind === "grafana" && integration.status === "active",
    );
    const hasVercel = integrations.some(
      (integration) => integration.kind === "vercel" && integration.status === "active",
    );
    const hasBilling = billingAccounts.some((account) =>
      ["active", "checkout_pending"].includes(account.status),
    );

    const steps = [
      {
        key: "auth",
        label: "Authenticate",
        status: "complete",
        browserRequired: false,
        description: "You are signed in through WorkOS.",
      },
      {
        key: "organization",
        label: "Create organization",
        status: organization ? "complete" : "pending",
        browserRequired: false,
        description: organization
          ? `Using ${organization.name}.`
          : "Create or select your organization.",
      },
      {
        key: "project",
        label: "Create project",
        status: projects.length > 0 ? "complete" : organization ? "pending" : "blocked",
        browserRequired: false,
        description:
          projects.length > 0
            ? `Primary project: ${projects[0].name}.`
            : "Create your first release-tracking project.",
      },
      {
        key: "github",
        label: "Connect GitHub",
        status: hasGithub ? "complete" : projects.length > 0 ? "pending" : "blocked",
        browserRequired: true,
        description:
          hasGithub
            ? "GitHub is configured."
            : "Install the GitHub App and bind repositories to your project.",
      },
      {
        key: "vercel",
        label: "Connect Vercel",
        status: hasVercel ? "complete" : projects.length > 0 ? "pending" : "blocked",
        browserRequired: true,
        description:
          hasVercel
            ? "Vercel deployment access is configured."
            : "Authorize the DeployTitan Vercel app so releases can read deployment status and logs securely.",
      },
      {
        key: "slack",
        label: "Connect Slack",
        status: hasSlack ? "complete" : projects.length > 0 ? "pending" : "blocked",
        browserRequired: true,
        description:
          hasSlack
            ? "Slack approval delivery is configured."
            : "Configure Slack for stakeholder approvals and status messages.",
      },
      {
        key: "grafana",
        label: "Connect Grafana",
        status: hasGrafana ? "complete" : projects.length > 0 ? "pending" : "blocked",
        browserRequired: true,
        description:
          hasGrafana
            ? "Grafana monitoring is configured."
            : "Configure Grafana for post-release monitoring.",
      },
      {
        key: "billing",
        label: "Choose plan",
        status: hasBilling ? "complete" : organization ? "pending" : "blocked",
        browserRequired: true,
        description:
          hasBilling
            ? "Billing is configured or checkout is in progress."
            : "Open hosted checkout and choose the organization billing plan.",
      },
    ] as const;

    const nextStep = steps.find((step) => step.status === "pending") ?? null;

    return {
      status:
        nextStep === null
          ? "ready"
          : organization
            ? "in_progress"
            : "not_started",
      currentStep: nextStep?.key ?? "ready",
      nextStep,
      steps,
      organization: organization
        ? {
            workosOrgId: organization.workosOrgId,
            name: organization.name,
          }
        : null,
      projects: projects.map((project) => ({
        publicId: project.publicId,
        name: project.name,
      })),
      billingProviders: ["paddle", "polar"],
      githubInstallUrl: getGithubAppInstallUrl() || null,
      availableBrowserSteps: {
        github: getGithubAppInstallUrl() || null,
        vercel: null,
        slack: null,
        grafana: null,
        billing: null,
      },
    };
  },
});

export const updateOnboardingProgress = mutation({
  args: {
    currentStep: v.string(),
    completedStep: v.optional(v.string()),
    pendingBrowserStep: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const organization = viewer.defaultWorkosOrgId
      ? await getOrganizationByWorkosOrgId(ctx, viewer.defaultWorkosOrgId)
      : null;
    const state = await getOrCreateOnboardingState(
      ctx,
      viewer._id,
      organization?._id,
    );

    const continuationToken = args.pendingBrowserStep
      ? createContinuationToken()
      : state.continuationToken;

    await ctx.db.patch(state._id, {
      organizationId: organization?._id ?? state.organizationId,
      status: args.pendingBrowserStep ? "in_progress" : state.status,
      currentStep: args.currentStep,
      completedSteps: args.completedStep
        ? uniqueSteps([...state.completedSteps, args.completedStep])
        : state.completedSteps,
      pendingBrowserStep: args.pendingBrowserStep,
      continuationToken,
      notes: args.notes ?? state.notes,
      updatedAt: now(),
    });

    return {
      continuationToken: continuationToken ?? null,
    };
  },
});

export const completeBrowserContinuation = mutation({
  args: {
    continuationToken: v.string(),
    completedStep: v.string(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("onboardingStates")
      .filter((q) => q.eq(q.field("continuationToken"), args.continuationToken))
      .first();

    if (!state) {
      throw new Error("Onboarding continuation not found.");
    }

    await ctx.db.patch(state._id, {
      completedSteps: uniqueSteps([...state.completedSteps, args.completedStep]),
      currentStep: args.completedStep,
      pendingBrowserStep: undefined,
      continuationToken: undefined,
      status: "in_progress",
      updatedAt: now(),
    });

    return {
      ok: true,
    };
  },
});

export const upsertVercelIntegration = mutation({
  args: {
    projectPublicId: v.string(),
    accessTokenCiphertext: v.string(),
    refreshTokenCiphertext: v.optional(v.string()),
    tokenScope: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    vercelUserId: v.string(),
    vercelUserEmail: v.optional(v.string()),
    vercelUserName: v.optional(v.string()),
    vercelUserAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    if (!viewer.defaultWorkosOrgId) {
      throw new Error("No active organization.");
    }

    const organization = await getOrganizationByWorkosOrgId(ctx, viewer.defaultWorkosOrgId);
    if (!organization) {
      throw new Error("Organization not found.");
    }

    const project = await getProjectByPublicId(ctx, organization._id, args.projectPublicId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const existing = await ctx.db
      .query("projectIntegrations")
      .withIndex("by_project_id_and_kind", (q) =>
        q.eq("projectId", project._id).eq("kind", "vercel"),
      )
      .unique();

    const timestamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        vercelAccessTokenCiphertext: args.accessTokenCiphertext,
        vercelRefreshTokenCiphertext: args.refreshTokenCiphertext,
        vercelTokenScope: args.tokenScope,
        vercelAccessTokenExpiresAt: args.accessTokenExpiresAt,
        vercelUserId: args.vercelUserId,
        vercelUserEmail: args.vercelUserEmail,
        vercelUserName: args.vercelUserName,
        vercelUserAvatarUrl: args.vercelUserAvatarUrl,
        updatedAt: timestamp,
      });

      return (await ctx.db.get(existing._id))!;
    }

    const id = await ctx.db.insert("projectIntegrations", {
      projectId: project._id,
      kind: "vercel",
      status: "active",
      vercelAccessTokenCiphertext: args.accessTokenCiphertext,
      vercelRefreshTokenCiphertext: args.refreshTokenCiphertext,
      vercelTokenScope: args.tokenScope,
      vercelAccessTokenExpiresAt: args.accessTokenExpiresAt,
      vercelUserId: args.vercelUserId,
      vercelUserEmail: args.vercelUserEmail,
      vercelUserName: args.vercelUserName,
      vercelUserAvatarUrl: args.vercelUserAvatarUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return (await ctx.db.get(id))!;
  },
});
