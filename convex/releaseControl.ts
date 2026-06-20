import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
type ReleaseLifecycleStatus =
  | "draft"
  | "awaiting_approvals"
  | "approved"
  | "merging"
  | "merged"
  | "monitoring"
  | "completed"
  | "alerted"
  | "failed"
  | "cancelled"
  | "ready"
  | "in_progress"
  | "shipped"
  | "blocked";

type ConvexCtx = QueryCtx | MutationCtx;

function now() {
  return Date.now();
}

function createPublicId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function createActionToken() {
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

function stringifyPayload(payload: unknown) {
  return JSON.stringify(payload);
}

function parseGrafanaValue(payload: unknown): number | null {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.value === "number" && Number.isFinite(record.value)) {
      return record.value;
    }

    if (typeof record.value === "string") {
      const parsed = Number(record.value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const nestedData = record.data;
    if (nestedData) {
      const nestedValue = parseGrafanaValue(nestedData);
      if (nestedValue !== null) {
        return nestedValue;
      }
    }

    const nestedResult = record.result;
    if (Array.isArray(nestedResult) && nestedResult.length > 0) {
      const first = nestedResult[0];
      if (first && typeof first === "object") {
        const firstRecord = first as Record<string, unknown>;
        if (
          Array.isArray(firstRecord.value) &&
          typeof firstRecord.value[1] === "string"
        ) {
          const parsed = Number(firstRecord.value[1]);
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
    }
  }

  return null;
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

async function getProjectByPublicId(ctx: ConvexCtx, publicId: string) {
  return await ctx.db
    .query("projects")
    .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
    .unique();
}

async function getPullRequestByPublicId(ctx: ConvexCtx, publicId: string) {
  return await ctx.db
    .query("pullRequests")
    .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
    .unique();
}

async function getReleaseByPublicId(ctx: ConvexCtx, publicId: string) {
  return await ctx.db
    .query("releasePackets")
    .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
    .unique();
}

async function requireMembership(
  ctx: ConvexCtx,
  organizationId: Id<"organizations">,
) {
  const { viewer } = await requireViewer(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_id_and_user_id", (q) =>
      q.eq("organizationId", organizationId).eq("userId", viewer._id),
    )
    .unique();

  if (!membership) {
    throw new Error("Forbidden.");
  }

  return { viewer, membership };
}

async function requireProjectAccess(ctx: ConvexCtx, projectPublicId: string) {
  const project = await getProjectByPublicId(ctx, projectPublicId);
  if (!project) {
    throw new Error("Project not found.");
  }

  await requireMembership(ctx, project.orgId);
  return project;
}

async function requireReleaseAccess(ctx: ConvexCtx, releasePublicId: string) {
  const release = await getReleaseByPublicId(ctx, releasePublicId);
  if (!release) {
    throw new Error("Release not found.");
  }

  const project = await ctx.db.get(release.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  await requireMembership(ctx, project.orgId);
  return { release, project };
}

async function getIntegrationByKind(
  ctx: ConvexCtx,
  projectId: Id<"projects">,
  kind: "github" | "slack" | "grafana",
) {
  return await ctx.db
    .query("projectIntegrations")
    .withIndex("by_project_id_and_kind", (q) =>
      q.eq("projectId", projectId).eq("kind", kind),
    )
    .unique();
}

async function buildActorContext(ctx: ConvexCtx) {
  const { viewer } = await requireViewer(ctx);
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user_id", (q) => q.eq("userId", viewer._id))
    .take(100);

  const organizations = (
    await Promise.all(
      memberships.map(async (membership) => {
        const organization = await ctx.db.get(membership.organizationId);
        return organization
          ? {
              id: organization._id,
              workosOrgId: organization.workosOrgId,
              name: organization.name,
              role: membership.role,
              joinedAt: membership.joinedAt,
            }
          : null;
      }),
    )
  ).filter((value): value is NonNullable<typeof value> => value !== null);

  return {
    user: {
      id: viewer._id,
      workosUserId: viewer.workosUserId ?? null,
      email: viewer.email ?? null,
      firstName: viewer.firstName ?? null,
      lastName: viewer.lastName ?? null,
    },
    activeWorkosOrgId:
      viewer.defaultWorkosOrgId ?? organizations[0]?.workosOrgId ?? null,
    organizations,
  };
}

function mapPullRequest(
  pullRequest: Doc<"pullRequests">,
  repository: Doc<"repositories"> | null,
  project: Doc<"projects">,
) {
  return {
    id: pullRequest._id,
    publicId: pullRequest.publicId,
    number: pullRequest.number ?? null,
    title: pullRequest.title,
    status: pullRequest.status,
    url: pullRequest.url ?? null,
    authorName: pullRequest.authorName ?? null,
    baseBranch: pullRequest.baseBranch ?? null,
    headBranch: pullRequest.headBranch ?? null,
    mergedAt: pullRequest.mergedAt ?? null,
    repository: repository
      ? {
          publicId: repository.publicId,
          repoOwner: repository.repoOwner,
          repoName: repository.repoName,
          defaultBranch: repository.defaultBranch ?? null,
        }
      : null,
    project: {
      publicId: project.publicId,
      name: project.name,
    },
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
  };
}

function mapReleaseStatus(status: ReleaseLifecycleStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "awaiting_approvals":
      return "Awaiting approvals";
    case "approved":
      return "Approved";
    case "merging":
      return "Merging";
    case "merged":
      return "Merged";
    case "monitoring":
      return "Monitoring";
    case "completed":
      return "Completed";
    case "alerted":
      return "Alerted";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "ready":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "shipped":
      return "Shipped";
    case "blocked":
      return "Blocked";
  }
}

async function appendReleaseEvent(
  ctx: MutationCtx,
  args: {
    releasePacketId: Id<"releasePackets">;
    actorUserId?: Id<"users">;
    source: "mcp" | "slack" | "github" | "monitoring" | "system";
    kind: string;
    summary: string;
    payload?: unknown;
  },
) {
  await ctx.db.insert("releaseEvents", {
    releasePacketId: args.releasePacketId,
    actorUserId: args.actorUserId,
    source: args.source,
    kind: args.kind,
    summary: args.summary,
    payloadJson: args.payload ? stringifyPayload(args.payload) : undefined,
    createdAt: now(),
  });
}

async function buildReleaseSummaryRecord(ctx: ConvexCtx, release: Doc<"releasePackets">) {
  const project = await ctx.db.get(release.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const organization = await ctx.db.get(project.orgId);
  if (!organization) {
    throw new Error("Organization not found.");
  }

  const [releasePullRequests, approvals, executionRuns, monitoringSessions] =
    await Promise.all([
      ctx.db
        .query("releasePacketPullRequests")
        .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
        .take(200),
      ctx.db
        .query("releaseApprovals")
        .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
        .take(200),
      ctx.db
        .query("releaseExecutionRuns")
        .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
        .take(50),
      ctx.db
        .query("releaseMonitoringSessions")
        .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
        .take(50),
    ]);

  const pullRequests = await Promise.all(
    releasePullRequests.map(async (row) => {
      const pullRequest = await ctx.db.get(row.pullRequestId);
      if (!pullRequest) {
        return null;
      }
      const repository = pullRequest.repositoryId
        ? await ctx.db.get(pullRequest.repositoryId)
        : null;
      return mapPullRequest(pullRequest, repository, project);
    }),
  );

  const normalizedPullRequests = pullRequests.filter(
    (value): value is NonNullable<typeof value> => value !== null,
  );

  return {
    release: {
      publicId: release.publicId,
      name: release.name,
      description: release.description,
      status: release.status,
      statusLabel: mapReleaseStatus(release.status as ReleaseLifecycleStatus),
      outcome: release.outcome,
      successMetric: release.successMetric,
      shipPlan: release.shipPlan,
      targetEnvironment: release.targetEnvironment ?? null,
      approvalSummary: release.approvalSummary ?? null,
      riskSummary: release.riskSummary ?? null,
      monitorWindowMinutes: release.monitorWindowMinutes ?? 30,
      createdAt: release.createdAt,
      updatedAt: release.updatedAt,
    },
    project: {
      publicId: project.publicId,
      name: project.name,
    },
    organization: {
      workosOrgId: organization.workosOrgId,
      name: organization.name,
    },
    pullRequests: normalizedPullRequests,
    approvals: {
      total: approvals.length,
      approved: approvals.filter((approval) => approval.status === "approved").length,
      rejected: approvals.filter((approval) => approval.status === "rejected").length,
      pending: approvals.filter((approval) => approval.status === "pending").length,
      items: approvals.map((approval) => ({
        requestPublicId: approval.requestPublicId,
        approverName: approval.approverName,
        approverEmail: approval.approverEmail ?? null,
        approverRole: approval.approverRole ?? null,
        status: approval.status,
        source: approval.source,
        respondedAt: approval.respondedAt ?? null,
        updatedAt: approval.updatedAt,
      })),
    },
    execution: executionRuns
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((run) => ({
        id: run._id,
        status: run.status,
        mergePolicy: run.mergePolicy,
        totalPullRequests: run.totalPullRequests,
        mergedPullRequests: run.mergedPullRequests,
        failedPullRequests: run.failedPullRequests,
        errorSummary: run.errorSummary ?? null,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
      })),
    monitoring: monitoringSessions
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((session) => ({
        id: session._id,
        status: session.status,
        metricName: session.metricName,
        baselineValue: session.baselineValue ?? null,
        latestValue: session.latestValue ?? null,
        thresholdPercent: session.thresholdPercent,
        alertCount: session.alertCount,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        completedAt: session.completedAt ?? null,
      })),
  };
}

export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const actor = await buildActorContext(ctx);

    if (!actor.user) {
      return {
        ready: false,
        reason: "viewer_not_provisioned",
        organizations: [],
        projects: [],
        githubInstallUrl: getGithubAppInstallUrl() || null,
      };
    }

    const activeOrg =
      actor.activeWorkosOrgId ??
      actor.organizations[0]?.workosOrgId ??
      null;
    if (!activeOrg) {
      return {
        ready: false,
        reason: "organization_required",
        organizations: actor.organizations,
        projects: [],
        githubInstallUrl: getGithubAppInstallUrl() || null,
      };
    }

    const organization = await getOrganizationByWorkosOrgId(ctx, activeOrg);
    if (!organization) {
      return {
        ready: false,
        reason: "organization_not_synced",
        organizations: actor.organizations,
        projects: [],
        githubInstallUrl: getGithubAppInstallUrl() || null,
      };
    }

    await requireMembership(ctx, organization._id);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q) => q.eq("orgId", organization._id))
      .take(100);

    return {
      ready: projects.length > 0,
      reason: projects.length > 0 ? "ready" : "project_required",
      organizations: actor.organizations,
      projects: projects.map((project) => ({
        publicId: project.publicId,
        name: project.name,
        slug: project.slug,
      })),
      githubInstallUrl: getGithubAppInstallUrl() || null,
    };
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => await buildActorContext(ctx),
});

export const searchPullRequests = query({
  args: {
    workosOrgId: v.optional(v.string()),
    projectPublicId: v.optional(v.string()),
    queryText: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    if (args.projectPublicId) {
      const project = await requireProjectAccess(ctx, args.projectPublicId);
      const pullRequests = await ctx.db
        .query("pullRequests")
        .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(200);

      const filtered = [];
      for (const pullRequest of pullRequests) {
        const repository = pullRequest.repositoryId
          ? await ctx.db.get(pullRequest.repositoryId)
          : null;
        const normalized = mapPullRequest(pullRequest, repository, project);
        const queryMatches = args.queryText
          ? [
              normalized.title,
              normalized.authorName ?? "",
              normalized.repository?.repoOwner ?? "",
              normalized.repository?.repoName ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(args.queryText.toLowerCase())
          : true;
        const statusMatches = args.status ? normalized.status === args.status : true;
        if (queryMatches && statusMatches) {
          filtered.push(normalized);
        }
      }

      return {
        project: {
          publicId: project.publicId,
          name: project.name,
        },
        pullRequests: filtered.slice(0, limit),
      };
    }

    const actor = await ctx.runQuery(api.actors.getActorContext, {});
    const orgId = args.workosOrgId ?? actor.activeWorkosOrgId ?? null;
    if (!orgId) {
      return { project: null, pullRequests: [] };
    }

    const organization = await getOrganizationByWorkosOrgId(ctx, orgId);
    if (!organization) {
      return { project: null, pullRequests: [] };
    }

    await requireMembership(ctx, organization._id);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q) => q.eq("orgId", organization._id))
      .take(100);

    const matches: ReturnType<typeof mapPullRequest>[] = [];
    for (const project of projects) {
      const pullRequests = await ctx.db
        .query("pullRequests")
        .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(100);

      for (const pullRequest of pullRequests) {
        const repository = pullRequest.repositoryId
          ? await ctx.db.get(pullRequest.repositoryId)
          : null;
        const normalized = mapPullRequest(pullRequest, repository, project);
        const queryMatches = args.queryText
          ? [
              normalized.title,
              normalized.authorName ?? "",
              normalized.repository?.repoOwner ?? "",
              normalized.repository?.repoName ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(args.queryText.toLowerCase())
          : true;
        const statusMatches = args.status ? normalized.status === args.status : true;
        if (queryMatches && statusMatches) {
          matches.push(normalized);
        }
      }
    }

    matches.sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      project: null,
      pullRequests: matches.slice(0, limit),
    };
  },
});

export const configureProjectIntegration = mutation({
  args: {
    projectPublicId: v.string(),
    kind: v.union(v.literal("github"), v.literal("slack"), v.literal("grafana")),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    slackIncomingWebhookUrl: v.optional(v.string()),
    slackDefaultChannel: v.optional(v.string()),
    githubToken: v.optional(v.string()),
    githubInstallUrl: v.optional(v.string()),
    grafanaEndpointUrl: v.optional(v.string()),
    grafanaApiToken: v.optional(v.string()),
    grafanaMetricName: v.optional(v.string()),
    grafanaAlertThresholdPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const existing = await getIntegrationByKind(ctx, project._id, args.kind);
    const timestamp = now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status ?? existing.status,
        slackIncomingWebhookUrl:
          args.slackIncomingWebhookUrl ?? existing.slackIncomingWebhookUrl,
        slackDefaultChannel:
          args.slackDefaultChannel ?? existing.slackDefaultChannel,
        githubToken: args.githubToken ?? existing.githubToken,
        githubInstallUrl: args.githubInstallUrl ?? existing.githubInstallUrl,
        grafanaEndpointUrl:
          args.grafanaEndpointUrl ?? existing.grafanaEndpointUrl,
        grafanaApiToken: args.grafanaApiToken ?? existing.grafanaApiToken,
        grafanaMetricName:
          args.grafanaMetricName ?? existing.grafanaMetricName,
        grafanaAlertThresholdPercent:
          args.grafanaAlertThresholdPercent ??
          existing.grafanaAlertThresholdPercent,
        updatedAt: timestamp,
      });
      return await ctx.db.get(existing._id);
    }

    const integrationId = await ctx.db.insert("projectIntegrations", {
      projectId: project._id,
      kind: args.kind,
      status: args.status ?? "active",
      slackIncomingWebhookUrl: args.slackIncomingWebhookUrl,
      slackDefaultChannel: args.slackDefaultChannel,
      githubToken: args.githubToken,
      githubInstallUrl: args.githubInstallUrl,
      grafanaEndpointUrl: args.grafanaEndpointUrl,
      grafanaApiToken: args.grafanaApiToken,
      grafanaMetricName: args.grafanaMetricName,
      grafanaAlertThresholdPercent: args.grafanaAlertThresholdPercent,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return await ctx.db.get(integrationId);
  },
});

export const createReleasePacket = mutation({
  args: {
    projectPublicId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    targetEnvironment: v.optional(v.string()),
    successMetric: v.optional(v.string()),
    shipPlan: v.optional(v.string()),
    outcome: v.optional(v.string()),
    approvalSummary: v.optional(v.string()),
    riskSummary: v.optional(v.string()),
    monitorWindowMinutes: v.optional(v.number()),
    pullRequestPublicIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const timestamp = now();

    const releasePacketId = await ctx.db.insert("releasePackets", {
      projectId: project._id,
      publicId: createPublicId("rel"),
      name: args.name,
      description: args.description ?? "",
      status: "draft",
      outcome: args.outcome ?? "",
      successMetric: args.successMetric ?? "",
      shipPlan: args.shipPlan ?? "",
      targetEnvironment: args.targetEnvironment,
      approvalSummary: args.approvalSummary,
      riskSummary: args.riskSummary,
      monitorWindowMinutes: args.monitorWindowMinutes ?? 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    for (const pullRequestPublicId of args.pullRequestPublicIds) {
      const pullRequest = await getPullRequestByPublicId(ctx, pullRequestPublicId);
      if (!pullRequest || pullRequest.projectId !== project._id) {
        continue;
      }

      await ctx.db.insert("releasePacketPullRequests", {
        releasePacketId,
        pullRequestId: pullRequest._id,
        createdAt: timestamp,
      });
    }

    await appendReleaseEvent(ctx, {
      releasePacketId,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.created",
      summary: `Release packet ${args.name} created`,
      payload: {
        projectPublicId: project.publicId,
        pullRequestPublicIds: args.pullRequestPublicIds,
      },
    });

    const release = (await ctx.db.get(releasePacketId))!;
    return await buildReleaseSummaryRecord(ctx, release);
  },
});

export const updateReleasePacket = mutation({
  args: {
    releasePublicId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetEnvironment: v.optional(v.string()),
    successMetric: v.optional(v.string()),
    shipPlan: v.optional(v.string()),
    outcome: v.optional(v.string()),
    approvalSummary: v.optional(v.string()),
    riskSummary: v.optional(v.string()),
    monitorWindowMinutes: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);

    await ctx.db.patch(release._id, {
      name: args.name ?? release.name,
      description: args.description ?? release.description,
      targetEnvironment: args.targetEnvironment ?? release.targetEnvironment,
      successMetric: args.successMetric ?? release.successMetric,
      shipPlan: args.shipPlan ?? release.shipPlan,
      outcome: args.outcome ?? release.outcome,
      approvalSummary: args.approvalSummary ?? release.approvalSummary,
      riskSummary: args.riskSummary ?? release.riskSummary,
      monitorWindowMinutes:
        args.monitorWindowMinutes ?? release.monitorWindowMinutes,
      status: (args.status as ReleaseLifecycleStatus | undefined) ?? release.status,
      updatedAt: now(),
    });

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.updated",
      summary: `Release ${release.publicId} updated`,
      payload: args,
    });

    const updated = (await ctx.db.get(release._id))!;
    return await buildReleaseSummaryRecord(ctx, updated);
  },
});

export const getReleaseSummary = query({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    return await buildReleaseSummaryRecord(ctx, release);
  },
});

export const getReleaseTimeline = query({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const events = await ctx.db
      .query("releaseEvents")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .order("desc")
      .take(200);

    return {
      releasePublicId: release.publicId,
      timeline: events.map((event) => ({
        id: event._id,
        source: event.source,
        kind: event.kind,
        summary: event.summary,
        payload: event.payloadJson ? JSON.parse(event.payloadJson) : null,
        createdAt: event.createdAt,
      })),
    };
  },
});

export const requestReleaseApprovals = mutation({
  args: {
    releasePublicId: v.string(),
    approvers: v.array(
      v.object({
        name: v.string(),
        email: v.optional(v.string()),
        role: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const { release, project } = await requireReleaseAccess(ctx, args.releasePublicId);
    const existingApprovals = await ctx.db
      .query("releaseApprovals")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .take(200);

    for (const approval of existingApprovals) {
      if (approval.status === "pending") {
        await ctx.db.patch(approval._id, {
          status: "cancelled",
          updatedAt: now(),
          respondedAt: now(),
        });
      }
    }

    const releaseSummary = await buildReleaseSummaryRecord(ctx, release);
    const requestPublicId = createPublicId("approval");
    const timestamp = now();

    for (const approver of args.approvers) {
      const actionToken = createActionToken();
      const approvalId = await ctx.db.insert("releaseApprovals", {
        releasePacketId: release._id,
        requestPublicId,
        approverName: approver.name,
        approverEmail: approver.email,
        approverRole: approver.role,
        status: "pending",
        source: "slack",
        actionToken,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      await ctx.db.insert("releaseNotifications", {
        releasePacketId: release._id,
        kind: "approval_request",
        destination: "slack",
        status: "pending",
        payloadJson: stringifyPayload({
          approvalId,
          actionToken,
          approverName: approver.name,
          approverEmail: approver.email ?? null,
          projectName: project.name,
          releaseName: release.name,
          releasePublicId: release.publicId,
          releaseSummary,
        }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await ctx.db.patch(release._id, {
      status: "awaiting_approvals",
      updatedAt: timestamp,
    });

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.approvals_requested",
      summary: `Requested approvals from ${args.approvers.length} stakeholder(s)`,
      payload: {
        requestPublicId,
        approvers: args.approvers,
      },
    });

    return {
      requestPublicId,
      releasePublicId: release.publicId,
      pendingApprovals: args.approvers.length,
    };
  },
});

export const getReleaseApprovalStatus = query({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const approvals = await ctx.db
      .query("releaseApprovals")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .take(200);

    return {
      releasePublicId: release.publicId,
      status: release.status,
      approvals: approvals.map((approval) => ({
        requestPublicId: approval.requestPublicId,
        approverName: approval.approverName,
        approverEmail: approval.approverEmail ?? null,
        approverRole: approval.approverRole ?? null,
        status: approval.status,
        source: approval.source,
        respondedAt: approval.respondedAt ?? null,
      })),
      summary: {
        total: approvals.length,
        approved: approvals.filter((approval) => approval.status === "approved").length,
        rejected: approvals.filter((approval) => approval.status === "rejected").length,
        pending: approvals.filter((approval) => approval.status === "pending").length,
      },
    };
  },
});

export const sendReleaseApprovalReminders = mutation({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const { release, project } = await requireReleaseAccess(ctx, args.releasePublicId);
    const approvals = await ctx.db
      .query("releaseApprovals")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .take(200);

    const pending = approvals.filter((approval) => approval.status === "pending");
    for (const approval of pending) {
      await ctx.db.insert("releaseNotifications", {
        releasePacketId: release._id,
        kind: "approval_reminder",
        destination: "slack",
        status: "pending",
        payloadJson: stringifyPayload({
          actionToken: approval.actionToken,
          approverName: approval.approverName,
          approverEmail: approval.approverEmail ?? null,
          projectName: project.name,
          releaseName: release.name,
          releasePublicId: release.publicId,
          reminder: true,
        }),
        createdAt: now(),
        updatedAt: now(),
      });
    }

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.approval_reminders_sent",
      summary: `Queued ${pending.length} approval reminder(s)`,
    });

    return {
      releasePublicId: release.publicId,
      remindersQueued: pending.length,
    };
  },
});

export const resolveReleaseApprovalByToken = mutation({
  args: {
    actionToken: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    slackUserId: v.optional(v.string()),
    slackDisplayName: v.optional(v.string()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db
      .query("releaseApprovals")
      .withIndex("by_action_token", (q) => q.eq("actionToken", args.actionToken))
      .unique();

    if (!approval) {
      throw new Error("Approval action token is invalid.");
    }

    if (approval.status !== "pending") {
      return {
        ok: true,
        duplicate: true,
        releasePacketId: approval.releasePacketId,
        status: approval.status,
      };
    }

    const timestamp = now();
    await ctx.db.patch(approval._id, {
      status: args.decision,
      source: "slack",
      slackUserId: args.slackUserId,
      decisionComment: args.comment,
      respondedAt: timestamp,
      updatedAt: timestamp,
    });

    const release = await ctx.db.get(approval.releasePacketId);
    if (!release) {
      throw new Error("Release not found.");
    }

    const allApprovals = await ctx.db
      .query("releaseApprovals")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", approval.releasePacketId))
      .take(200);

    const hasRejected = allApprovals.some((entry) => entry.status === "rejected");
    const allApproved =
      allApprovals.length > 0 &&
      allApprovals.every((entry) => entry.status === "approved");

    let nextStatus: ReleaseLifecycleStatus = release.status as ReleaseLifecycleStatus;
    if (hasRejected) {
      nextStatus = "blocked";
    } else if (allApproved) {
      nextStatus = "approved";
    }

    if (nextStatus !== release.status) {
      await ctx.db.patch(release._id, {
        status: nextStatus,
        updatedAt: timestamp,
      });
    }

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      source: "slack",
      kind: `release.approval_${args.decision}`,
      summary: `${args.slackDisplayName ?? approval.approverName} ${args.decision} release ${release.name}`,
      payload: {
        approverName: approval.approverName,
        slackUserId: args.slackUserId ?? null,
        comment: args.comment ?? null,
      },
    });

    await ctx.db.insert("releaseNotifications", {
      releasePacketId: release._id,
      kind: "status_update",
      destination: "slack",
      status: "pending",
      payloadJson: stringifyPayload({
        releaseName: release.name,
        releasePublicId: release.publicId,
        message: `${approval.approverName} ${args.decision} this release.`,
      }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      ok: true,
      duplicate: false,
      releasePacketId: release._id,
      status: nextStatus,
    };
  },
});

export const mergeReleasePullRequests = action({
  args: {
    releasePublicId: v.string(),
    mergeMethod: v.optional(v.union(v.literal("merge"), v.literal("squash"), v.literal("rebase"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    executionRunId: Id<"releaseExecutionRuns">;
    status: string;
    mergedPullRequests?: number;
    failedPullRequests?: number;
    errorSummary?: string | null;
  }> => {
    const summary: any = await ctx.runQuery(
      internal.releaseControl.getReleaseSummaryForAction,
      {
        releasePublicId: args.releasePublicId,
      },
    );

    const project: any = await ctx.runQuery(internal.releaseControl.getProjectByReleasePublicId, {
      releasePublicId: args.releasePublicId,
    });
    if (!project) {
      throw new Error("Project not found.");
    }

    const githubIntegration: any = await ctx.runQuery(
      internal.releaseControl.getProjectIntegrationContext,
      {
        projectId: project.projectId,
        kind: "github",
      },
    );

    const executionRun: { executionRunId: Id<"releaseExecutionRuns"> } = await ctx.runMutation(
      internal.releaseControl.createExecutionRun,
      {
        releasePublicId: args.releasePublicId,
        mergeMethod: args.mergeMethod ?? "squash",
        totalPullRequests: summary.pullRequests.length,
      },
    );

    if (!githubIntegration?.githubToken) {
      await ctx.runMutation(internal.releaseControl.completeExecutionRun, {
        executionRunId: executionRun.executionRunId,
        status: "needs_configuration",
        mergedPullRequests: 0,
        failedPullRequests: summary.pullRequests.length,
        errorSummary: "Configure a GitHub token integration before running merges.",
      });
      return {
        executionRunId: executionRun.executionRunId,
        status: "needs_configuration",
      };
    }

    let mergedPullRequests = 0;
    let failedPullRequests = 0;
    let errorSummary: string | null = null;

    for (const pullRequest of summary.pullRequests) {
      const normalizedPullRequest: any = pullRequest;
      if (!normalizedPullRequest.repository || !normalizedPullRequest.number) {
        failedPullRequests += 1;
        errorSummary = "One or more pull requests are missing repository metadata.";
        await ctx.runMutation(internal.releaseControl.recordExecutionItemResult, {
          executionRunId: executionRun.executionRunId,
          pullRequestPublicId: normalizedPullRequest.publicId,
          status: "failed",
          errorMessage: errorSummary,
        });
        break;
      }

      const mergeResponse: Response = await fetch(
        `https://api.github.com/repos/${normalizedPullRequest.repository.repoOwner}/${normalizedPullRequest.repository.repoName}/pulls/${normalizedPullRequest.number}/merge`,
        {
          method: "PUT",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubIntegration.githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merge_method: args.mergeMethod ?? "squash",
          }),
        },
      );

      if (!mergeResponse.ok) {
        failedPullRequests += 1;
        const bodyText: string = await mergeResponse.text();
        errorSummary = `GitHub merge failed for ${normalizedPullRequest.publicId}: ${bodyText}`;
        await ctx.runMutation(internal.releaseControl.recordExecutionItemResult, {
          executionRunId: executionRun.executionRunId,
          pullRequestPublicId: normalizedPullRequest.publicId,
          status: "failed",
          errorMessage: errorSummary,
        });
        break;
      }

      mergedPullRequests += 1;
      await ctx.runMutation(internal.releaseControl.recordExecutionItemResult, {
        executionRunId: executionRun.executionRunId,
        pullRequestPublicId: normalizedPullRequest.publicId,
        status: "merged",
      });
    }

    const status =
      failedPullRequests > 0 ? "failed" : "succeeded";
    await ctx.runMutation(internal.releaseControl.completeExecutionRun, {
      executionRunId: executionRun.executionRunId,
      status,
      mergedPullRequests,
      failedPullRequests,
      errorSummary: errorSummary ?? undefined,
    });

    return {
      executionRunId: executionRun.executionRunId,
      status,
      mergedPullRequests,
      failedPullRequests,
      errorSummary,
    };
  },
});

export const startReleaseMonitoring = mutation({
  args: {
    releasePublicId: v.string(),
    metricName: v.string(),
    monitorWindowMinutes: v.optional(v.number()),
    thresholdPercent: v.optional(v.number()),
    pollIntervalMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const { release, project } = await requireReleaseAccess(ctx, args.releasePublicId);
    const grafanaIntegration = await getIntegrationByKind(ctx, project._id, "grafana");
    const timestamp = now();

    const sessionId = await ctx.db.insert("releaseMonitoringSessions", {
      releasePacketId: release._id,
      status:
        grafanaIntegration?.grafanaEndpointUrl && grafanaIntegration.status === "active"
          ? "pending"
          : "needs_configuration",
      metricName: args.metricName,
      thresholdPercent:
        args.thresholdPercent ??
        grafanaIntegration?.grafanaAlertThresholdPercent ??
        10,
      monitorWindowMinutes:
        args.monitorWindowMinutes ?? release.monitorWindowMinutes ?? 30,
      pollIntervalMinutes: args.pollIntervalMinutes ?? 5,
      startedAt: timestamp,
      endsAt:
        timestamp +
        (args.monitorWindowMinutes ?? release.monitorWindowMinutes ?? 30) * 60_000,
      alertCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.patch(release._id, {
      status:
        grafanaIntegration?.grafanaEndpointUrl && grafanaIntegration.status === "active"
          ? "monitoring"
          : "alerted",
      updatedAt: timestamp,
    });

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.monitoring_started",
      summary: `Monitoring started for ${args.metricName}`,
      payload: {
        sessionId,
      },
    });

    return {
      monitoringSessionId: sessionId,
      status:
        grafanaIntegration?.grafanaEndpointUrl && grafanaIntegration.status === "active"
          ? "pending"
          : "needs_configuration",
      pollIntervalMinutes: args.pollIntervalMinutes ?? 5,
    };
  },
});

export const getReleaseMonitoringStatus = query({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const sessions = await ctx.db
      .query("releaseMonitoringSessions")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .order("desc")
      .take(20);

    return {
      releasePublicId: release.publicId,
      sessions: sessions.map((session) => ({
        id: session._id,
        status: session.status,
        metricName: session.metricName,
        baselineValue: session.baselineValue ?? null,
        latestValue: session.latestValue ?? null,
        thresholdPercent: session.thresholdPercent,
        alertCount: session.alertCount,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        completedAt: session.completedAt ?? null,
      })),
    };
  },
});

export const getProjectByReleasePublicId = internalQuery({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) {
      return null;
    }
    const project = await ctx.db.get(release.projectId);
    return project
      ? {
          projectId: project._id,
          projectPublicId: project.publicId,
        }
      : null;
  },
});

export const getReleaseSummaryForAction = internalQuery({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) {
      throw new Error("Release not found.");
    }
    return await buildReleaseSummaryRecord(ctx, release);
  },
});

export const getProjectIntegrationContext = internalQuery({
  args: {
    projectId: v.id("projects"),
    kind: v.union(v.literal("github"), v.literal("slack"), v.literal("grafana")),
  },
  handler: async (ctx, args) => {
    return await getIntegrationByKind(ctx, args.projectId, args.kind);
  },
});

export const createExecutionRun = internalMutation({
  args: {
    releasePublicId: v.string(),
    mergeMethod: v.string(),
    totalPullRequests: v.number(),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const timestamp = now();

    const executionRunId = await ctx.db.insert("releaseExecutionRuns", {
      releasePacketId: release._id,
      triggeredByUserId: viewer._id,
      status: "running",
      mergePolicy: args.mergeMethod,
      totalPullRequests: args.totalPullRequests,
      mergedPullRequests: 0,
      failedPullRequests: 0,
      startedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const releasePullRequests = await ctx.db
      .query("releasePacketPullRequests")
      .withIndex("by_release_packet_id", (q) => q.eq("releasePacketId", release._id))
      .take(200);

    for (const row of releasePullRequests) {
      await ctx.db.insert("releaseExecutionItems", {
        executionRunId,
        pullRequestId: row.pullRequestId,
        status: "pending",
        attemptCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await ctx.db.patch(release._id, {
      status: "merging",
      updatedAt: timestamp,
    });

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      actorUserId: viewer._id,
      source: "mcp",
      kind: "release.merge_started",
      summary: `Started merge run with ${args.totalPullRequests} pull request(s)`,
      payload: {
        executionRunId,
        mergeMethod: args.mergeMethod,
      },
    });

    return {
      executionRunId,
    };
  },
});

export const recordExecutionItemResult = internalMutation({
  args: {
    executionRunId: v.id("releaseExecutionRuns"),
    pullRequestPublicId: v.string(),
    status: v.union(v.literal("merged"), v.literal("failed"), v.literal("skipped")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.executionRunId);
    if (!run) {
      throw new Error("Execution run not found.");
    }

    const pullRequest = await getPullRequestByPublicId(ctx, args.pullRequestPublicId);
    if (!pullRequest) {
      throw new Error("Pull request not found.");
    }

    const item = await ctx.db
      .query("releaseExecutionItems")
      .withIndex("by_pull_request_id", (q) => q.eq("pullRequestId", pullRequest._id))
      .filter((q) => q.eq(q.field("executionRunId"), args.executionRunId))
      .unique();

    if (!item) {
      throw new Error("Execution item not found.");
    }

    await ctx.db.patch(item._id, {
      status: args.status,
      attemptCount: item.attemptCount + 1,
      errorMessage: args.errorMessage,
      mergedAt: args.status === "merged" ? now() : undefined,
      updatedAt: now(),
    });
  },
});

export const completeExecutionRun = internalMutation({
  args: {
    executionRunId: v.id("releaseExecutionRuns"),
    status: v.union(
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("needs_configuration"),
    ),
    mergedPullRequests: v.number(),
    failedPullRequests: v.number(),
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.executionRunId);
    if (!run) {
      throw new Error("Execution run not found.");
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      mergedPullRequests: args.mergedPullRequests,
      failedPullRequests: args.failedPullRequests,
      errorSummary: args.errorSummary,
      completedAt: now(),
      updatedAt: now(),
    });

    const release = await ctx.db.get(run.releasePacketId);
    if (!release) {
      throw new Error("Release not found.");
    }

    const nextStatus: ReleaseLifecycleStatus =
      args.status === "succeeded" ? "merged" : args.status === "needs_configuration" ? "failed" : "failed";

    await ctx.db.patch(release._id, {
      status: nextStatus,
      updatedAt: now(),
    });

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      source: "github",
      kind: "release.merge_finished",
      summary:
        args.status === "succeeded"
          ? `Merged ${args.mergedPullRequests} pull request(s)`
          : `Merge run ended with status ${args.status}`,
      payload: args,
    });

    await ctx.db.insert("releaseNotifications", {
      releasePacketId: release._id,
      kind: "status_update",
      destination: "slack",
      status: "pending",
      payloadJson: stringifyPayload({
        releaseName: release.name,
        releasePublicId: release.publicId,
        message:
          args.status === "succeeded"
            ? `Merged ${args.mergedPullRequests} pull request(s).`
            : args.errorSummary ?? `Merge run ended with status ${args.status}.`,
      }),
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const listPendingNotifications = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("releaseNotifications")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(100);
  },
});

export const markNotificationDelivered = internalMutation({
  args: {
    notificationId: v.id("releaseNotifications"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      errorMessage: args.errorMessage,
      sentAt: args.status === "sent" ? now() : undefined,
      updatedAt: now(),
    });
  },
});

export const dispatchPendingNotifications = internalAction({
  args: {},
  handler: async (ctx): Promise<{ dispatched: number }> => {
    const notifications: any[] = await ctx.runQuery(
      internal.releaseControl.listPendingNotifications,
      {},
    );

    for (const notification of notifications) {
      const release = await ctx.runQuery(
        internal.releaseControl.getReleaseForNotification,
        {
          releasePacketId: notification.releasePacketId,
        },
      );

      if (!release?.slackIntegration?.slackIncomingWebhookUrl) {
        await ctx.runMutation(internal.releaseControl.markNotificationDelivered, {
          notificationId: notification._id,
          status: "failed",
          errorMessage: "Slack integration is not configured for this project.",
        });
        continue;
      }

      const payload = JSON.parse(notification.payloadJson) as Record<string, unknown>;
      const blocks =
        notification.kind === "approval_request" || notification.kind === "approval_reminder"
          ? [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text:
                    notification.kind === "approval_reminder"
                      ? `Reminder: *${payload.releaseName}* is still waiting for approval from *${payload.approverName}*.`
                      : `Approval requested from *${payload.approverName}* for *${payload.releaseName}*.`,
                },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    action_id: "release_approve",
                    text: { type: "plain_text", text: "Approve" },
                    style: "primary",
                    value: String(payload.actionToken ?? ""),
                  },
                  {
                    type: "button",
                    action_id: "release_reject",
                    text: { type: "plain_text", text: "Reject" },
                    style: "danger",
                    value: String(payload.actionToken ?? ""),
                  },
                ],
              },
            ]
          : [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: String(payload.message ?? "DeployTitan release update"),
                },
              },
            ];

      const response = await fetch(release.slackIntegration.slackIncomingWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: String(payload.message ?? `DeployTitan: ${release.releaseName}`),
          blocks,
        }),
      });

      await ctx.runMutation(internal.releaseControl.markNotificationDelivered, {
        notificationId: notification._id,
        status: response.ok ? "sent" : "failed",
        errorMessage: response.ok ? undefined : await response.text(),
      });
    }

    return {
      dispatched: notifications.length,
    };
  },
});

export const getReleaseForNotification = internalQuery({
  args: { releasePacketId: v.id("releasePackets") },
  handler: async (ctx, args) => {
    const release = await ctx.db.get(args.releasePacketId);
    if (!release) {
      return null;
    }
    const project = await ctx.db.get(release.projectId);
    if (!project) {
      return null;
    }
    const slackIntegration = await getIntegrationByKind(ctx, project._id, "slack");
    return {
      releaseName: release.name,
      releasePublicId: release.publicId,
      slackIntegration,
    };
  },
});

export const listActiveMonitoringSessions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("releaseMonitoringSessions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "running"),
          q.eq(q.field("status"), "healthy"),
          q.eq(q.field("status"), "alerted"),
        ),
      )
      .take(100);
  },
});

export const pollActiveMonitoringSessions = internalAction({
  args: {},
  handler: async (ctx): Promise<{ polled: number }> => {
    const sessions: any[] = await ctx.runQuery(
      internal.releaseControl.listActiveMonitoringSessions,
      {},
    );

    for (const session of sessions) {
      const context = await ctx.runQuery(
        internal.releaseControl.getMonitoringSessionContext,
        {
          monitoringSessionId: session._id,
        },
      );

      if (!context?.integration?.grafanaEndpointUrl) {
        continue;
      }

      const headers: HeadersInit = {
        Accept: "application/json",
      };
      if (context.integration.grafanaApiToken) {
        headers.Authorization = `Bearer ${context.integration.grafanaApiToken}`;
      }

      const response = await fetch(context.integration.grafanaEndpointUrl, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        await ctx.runMutation(internal.releaseControl.updateMonitoringSessionState, {
          monitoringSessionId: session._id,
          status: "failed",
          latestValue: undefined,
          alertTriggered: false,
        });
        continue;
      }

      const payload = await response.json();
      const value = parseGrafanaValue(payload);
      if (value === null) {
        await ctx.runMutation(internal.releaseControl.updateMonitoringSessionState, {
          monitoringSessionId: session._id,
          status: "failed",
          latestValue: undefined,
          alertTriggered: false,
        });
        continue;
      }

      await ctx.runMutation(internal.releaseControl.recordMonitoringValue, {
        monitoringSessionId: session._id,
        value,
        rawPayload: stringifyPayload(payload),
      });
    }

    return {
      polled: sessions.length,
    };
  },
});

export const getMonitoringSessionContext = internalQuery({
  args: { monitoringSessionId: v.id("releaseMonitoringSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.monitoringSessionId);
    if (!session) {
      return null;
    }
    const release = await ctx.db.get(session.releasePacketId);
    if (!release) {
      return null;
    }
    const project = await ctx.db.get(release.projectId);
    if (!project) {
      return null;
    }
    const integration = await getIntegrationByKind(ctx, project._id, "grafana");
    return {
      session,
      release,
      project,
      integration,
    };
  },
});

export const recordMonitoringValue = internalMutation({
  args: {
    monitoringSessionId: v.id("releaseMonitoringSessions"),
    value: v.number(),
    rawPayload: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.monitoringSessionId);
    if (!session) {
      throw new Error("Monitoring session not found.");
    }

    const timestamp = now();
    const isBaseline = session.baselineValue === undefined;
    const baselineValue = session.baselineValue ?? args.value;
    const deltaPercent =
      baselineValue === 0 ? 0 : Math.abs(((args.value - baselineValue) / baselineValue) * 100);
    const alertTriggered = !isBaseline && deltaPercent >= session.thresholdPercent;
    const nextStatus =
      timestamp >= session.endsAt
        ? "completed"
        : alertTriggered
          ? "alerted"
          : "running";

    await ctx.db.insert("releaseMonitoringSnapshots", {
      monitoringSessionId: session._id,
      kind: isBaseline ? "baseline" : "sample",
      metricName: session.metricName,
      value: args.value,
      status: alertTriggered ? "breached" : "ok",
      observedAt: timestamp,
      rawPayload: args.rawPayload,
    });

    await ctx.db.patch(session._id, {
      status: nextStatus,
      baselineValue,
      latestValue: args.value,
      lastCheckedAt: timestamp,
      alertCount: session.alertCount + (alertTriggered ? 1 : 0),
      completedAt: nextStatus === "completed" ? timestamp : undefined,
      updatedAt: timestamp,
    });

    const release = await ctx.db.get(session.releasePacketId);
    if (!release) {
      throw new Error("Release not found.");
    }

    if (alertTriggered) {
      await ctx.db.insert("releaseNotifications", {
        releasePacketId: release._id,
        kind: "monitoring_alert",
        destination: "slack",
        status: "pending",
        payloadJson: stringifyPayload({
          releaseName: release.name,
          releasePublicId: release.publicId,
          message: `${session.metricName} regressed by ${deltaPercent.toFixed(1)}% against baseline.`,
        }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (nextStatus === "completed") {
      await ctx.db.insert("releaseNotifications", {
        releasePacketId: release._id,
        kind: "monitoring_summary",
        destination: "slack",
        status: "pending",
        payloadJson: stringifyPayload({
          releaseName: release.name,
          releasePublicId: release.publicId,
          message: `Monitoring finished. Baseline ${baselineValue}, latest ${args.value}.`,
        }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await appendReleaseEvent(ctx, {
      releasePacketId: release._id,
      source: "monitoring",
      kind: "release.monitoring_sample",
      summary: `${session.metricName}: ${args.value}`,
      payload: {
        baselineValue,
        latestValue: args.value,
        deltaPercent,
        alertTriggered,
      },
    });
  },
});

export const updateMonitoringSessionState = internalMutation({
  args: {
    monitoringSessionId: v.id("releaseMonitoringSessions"),
    status: v.union(
      v.literal("failed"),
      v.literal("needs_configuration"),
      v.literal("running"),
      v.literal("alerted"),
      v.literal("completed"),
    ),
    latestValue: v.optional(v.number()),
    alertTriggered: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.monitoringSessionId);
    if (!session) {
      throw new Error("Monitoring session not found.");
    }

    await ctx.db.patch(session._id, {
      status: args.status,
      latestValue: args.latestValue,
      lastCheckedAt: now(),
      updatedAt: now(),
      completedAt: args.status === "completed" ? now() : undefined,
      alertCount: session.alertCount + (args.alertTriggered ? 1 : 0),
    });
  },
});
