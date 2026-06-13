import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

type ConvexCtx = QueryCtx | MutationCtx;

function now() {
  return Date.now();
}

function createPublicId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function getUserByTokenIdentifier(
  ctx: ConvexCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
}

async function getUserByWorkosUserId(
  ctx: ConvexCtx,
  workosUserId: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .unique();
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

async function getRepositoryByPublicId(ctx: ConvexCtx, publicId: string) {
  return await ctx.db
    .query("repositories")
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

async function getReleaseById(
  ctx: ConvexCtx,
  releaseId: Id<"releasePackets">,
): Promise<Doc<"releasePackets"> | null> {
  return await ctx.db.get(releaseId);
}

async function requireViewer(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized.");
  }

  const viewer = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!viewer) {
    throw new Error("Viewer is not provisioned.");
  }

  return { identity, viewer };
}

async function requireMembership(ctx: ConvexCtx, organizationId: Id<"organizations">) {
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

function mapUser(user: Doc<"users">) {
  return {
    id: user._id,
    tokenIdentifier: user.tokenIdentifier,
    workosUserId: user.workosUserId ?? null,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  };
}

function mapOrganization(organization: Doc<"organizations">) {
  return {
    id: organization._id,
    workosOrgId: organization.workosOrgId,
    name: organization.name,
    allocatedPlanId: organization.allocatedPlanId ?? null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function mapProject(project: Doc<"projects">) {
  return {
    id: project._id,
    publicId: project.publicId,
    name: project.name,
    slug: project.slug,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function mapRepository(repository: Doc<"repositories">) {
  return {
    id: repository._id,
    publicId: repository.publicId,
    repoVendor: repository.repoVendor,
    repoOwner: repository.repoOwner,
    repoName: repository.repoName,
    defaultBranch: repository.defaultBranch ?? null,
    installationStatus: repository.installationStatus ?? null,
    createdAt: repository.createdAt,
    updatedAt: repository.updatedAt,
  };
}

function mapPullRequest(
  pullRequest: Doc<"pullRequests">,
  repositoryPublicId: string | null,
) {
  return {
    id: pullRequest._id,
    publicId: pullRequest.publicId,
    repositoryPublicId,
    number: pullRequest.number ?? null,
    title: pullRequest.title,
    status: pullRequest.status,
    url: pullRequest.url ?? null,
    authorName: pullRequest.authorName ?? null,
    baseBranch: pullRequest.baseBranch ?? null,
    headBranch: pullRequest.headBranch ?? null,
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
    mergedAt: pullRequest.mergedAt ?? null,
  };
}

function mapReleasePacket(releasePacket: Doc<"releasePackets">) {
  return {
    id: releasePacket._id,
    publicId: releasePacket.publicId,
    name: releasePacket.name,
    description: releasePacket.description,
    status: releasePacket.status,
    outcome: releasePacket.outcome,
    successMetric: releasePacket.successMetric,
    shipPlan: releasePacket.shipPlan,
    createdAt: releasePacket.createdAt,
    updatedAt: releasePacket.updatedAt,
  };
}

export const syncSession = mutation({
  args: {
    user: v.object({
      workosUserId: v.string(),
      email: v.string(),
      firstName: v.optional(v.union(v.string(), v.null())),
      lastName: v.optional(v.union(v.string(), v.null())),
    }),
    organization: v.union(
      v.null(),
      v.object({
        workosOrgId: v.string(),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized.");
    }

    const timestamp = now();
    let user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

    if (user) {
      await ctx.db.patch(user._id, {
        workosUserId: args.user.workosUserId,
        email: args.user.email,
        firstName: args.user.firstName ?? undefined,
        lastName: args.user.lastName ?? undefined,
        updatedAt: timestamp,
      });
      user = (await ctx.db.get(user._id))!;
    } else {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        workosUserId: args.user.workosUserId,
        email: args.user.email,
        firstName: args.user.firstName ?? undefined,
        lastName: args.user.lastName ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      user = (await ctx.db.get(userId))!;
    }

    if (!args.organization) {
      return mapUser(user);
    }

    let organization = await getOrganizationByWorkosOrgId(
      ctx,
      args.organization.workosOrgId,
    );

    if (organization) {
      await ctx.db.patch(organization._id, {
        name: args.organization.name,
        updatedAt: timestamp,
      });
      organization = (await ctx.db.get(organization._id))!;
    } else {
      const organizationId = await ctx.db.insert("organizations", {
        workosOrgId: args.organization.workosOrgId,
        name: args.organization.name,
        allocatedPlanId: "starter",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      organization = (await ctx.db.get(organizationId))!;
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_id_and_user_id", (q) =>
        q.eq("organizationId", organization._id).eq("userId", user._id),
      )
      .unique();

    if (!membership) {
      await ctx.db.insert("memberships", {
        organizationId: organization._id,
        userId: user._id,
        role: "admin",
        joinedAt: timestamp,
      });
    }

    return mapUser(user);
  },
});

export const createOrganization = mutation({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx);
    const timestamp = now();

    let organization = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!organization) {
      const organizationId = await ctx.db.insert("organizations", {
        workosOrgId: args.workosOrgId,
        name: args.name,
        allocatedPlanId: "starter",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      organization = (await ctx.db.get(organizationId))!;
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_id_and_user_id", (q) =>
        q.eq("organizationId", organization._id).eq("userId", viewer._id),
      )
      .unique();

    if (!membership) {
      await ctx.db.insert("memberships", {
        organizationId: organization._id,
        userId: viewer._id,
        role: "admin",
        joinedAt: timestamp,
      });
    }

    return mapOrganization(organization);
  },
});

export const getOrgDashboard = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const organization = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!organization) {
      return { org: null, projects: [] };
    }

    await requireMembership(ctx, organization._id);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q) => q.eq("orgId", organization._id))
      .order("desc")
      .take(100);

    return {
      org: mapOrganization(organization),
      projects: projects.map(mapProject),
    };
  },
});

export const createProject = mutation({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!organization) {
      throw new Error("Organization not found.");
    }

    await requireMembership(ctx, organization._id);

    const timestamp = now();
    const projectId = await ctx.db.insert("projects", {
      orgId: organization._id,
      publicId: createPublicId("proj"),
      name: args.name,
      slug: slugify(args.name) || createPublicId("slug"),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return mapProject((await ctx.db.get(projectId))!);
  },
});

export const getProjectOverview = query({
  args: { projectPublicId: v.string() },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);

    const [repositories, pullRequests] = await Promise.all([
      ctx.db
        .query("repositories")
        .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("pullRequests")
        .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(100),
    ]);

    const repositoryById = new Map(
      repositories.map((repository) => [repository._id, repository]),
    );

    return {
      project: mapProject(project),
      repositories: repositories.map(mapRepository),
      pullRequests: pullRequests.map((pullRequest) =>
        mapPullRequest(
          pullRequest,
          pullRequest.repositoryId
            ? repositoryById.get(pullRequest.repositoryId)?.publicId ?? null
            : null,
        ),
      ),
    };
  },
});

export const createRepository = mutation({
  args: {
    projectPublicId: v.string(),
    repoOwner: v.string(),
    repoName: v.string(),
    defaultBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const timestamp = now();

    const repositoryId = await ctx.db.insert("repositories", {
      projectId: project._id,
      publicId: createPublicId("repo"),
      repoVendor: "github",
      repoOwner: args.repoOwner,
      repoName: args.repoName,
      defaultBranch: args.defaultBranch,
      installationStatus: "manual",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return mapRepository((await ctx.db.get(repositoryId))!);
  },
});

export const createPullRequest = mutation({
  args: {
    projectPublicId: v.string(),
    repositoryPublicId: v.optional(v.string()),
    number: v.optional(v.number()),
    title: v.string(),
    url: v.optional(v.string()),
    status: v.optional(v.string()),
    authorName: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    headBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const repository = args.repositoryPublicId
      ? await getRepositoryByPublicId(ctx, args.repositoryPublicId)
      : null;

    if (args.repositoryPublicId && !repository) {
      throw new Error("Repository not found.");
    }

    const timestamp = now();
    const pullRequestId = await ctx.db.insert("pullRequests", {
      projectId: project._id,
      repositoryId: repository?._id,
      publicId: createPublicId("pr"),
      number: args.number,
      title: args.title,
      status: args.status ?? "open",
      url: args.url,
      authorName: args.authorName,
      baseBranch: args.baseBranch,
      headBranch: args.headBranch,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return mapPullRequest(
      (await ctx.db.get(pullRequestId))!,
      repository?.publicId ?? null,
    );
  },
});

export const getProjectReleases = query({
  args: { projectPublicId: v.string() },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);

    const releases = await ctx.db
      .query("releasePackets")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(100);

    return {
      project: mapProject(project),
      releases: releases.map(mapReleasePacket),
    };
  },
});

export const createRelease = mutation({
  args: {
    projectPublicId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const timestamp = now();

    const releasePacketId = await ctx.db.insert("releasePackets", {
      projectId: project._id,
      publicId: createPublicId("rel"),
      name: args.name,
      description: args.description ?? "",
      status: "draft",
      outcome: "",
      successMetric: "",
      shipPlan: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return mapReleasePacket((await ctx.db.get(releasePacketId))!);
  },
});

export const deleteRelease = mutation({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);

    for (const item of await ctx.db
      .query("releaseItems")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100)) {
      await ctx.db.delete(item._id);
    }

    for (const participant of await ctx.db
      .query("releaseParticipants")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100)) {
      await ctx.db.delete(participant._id);
    }

    for (const releasePullRequest of await ctx.db
      .query("releasePacketPullRequests")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100)) {
      await ctx.db.delete(releasePullRequest._id);
    }

    for (const dependency of await ctx.db
      .query("releaseDependencies")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100)) {
      await ctx.db.delete(dependency._id);
    }

    await ctx.db.delete(release._id);
    return null;
  },
});

export const getReleaseDetail = query({
  args: { projectPublicId: v.string(), releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(ctx, args.projectPublicId);
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);

    if (!release || release.projectId !== project._id) {
      return {
        project: null,
        release: null,
        repositories: [],
        pullRequests: [],
        orgUsers: [],
      };
    }

    const [repositories, pullRequests, releaseItems, releaseParticipants, releasePullRequests, dependencies, memberships] =
      await Promise.all([
        ctx.db
          .query("repositories")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .order("desc")
          .take(100),
        ctx.db
          .query("pullRequests")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .order("desc")
          .take(100),
        ctx.db
          .query("releaseItems")
          .withIndex("by_release_packet_id", (q) =>
            q.eq("releasePacketId", release._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("releaseParticipants")
          .withIndex("by_release_packet_id", (q) =>
            q.eq("releasePacketId", release._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("releasePacketPullRequests")
          .withIndex("by_release_packet_id", (q) =>
            q.eq("releasePacketId", release._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("releaseDependencies")
          .withIndex("by_release_packet_id", (q) =>
            q.eq("releasePacketId", release._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("memberships")
          .withIndex("by_organization_id", (q) => q.eq("organizationId", project.orgId))
          .take(100),
      ]);

    const repositoryById = new Map(
      repositories.map((repository) => [repository._id, repository]),
    );
    const pullRequestById = new Map(
      pullRequests.map((pullRequest) => [pullRequest._id, pullRequest]),
    );

    const orgUsers = (
      await Promise.all(
        memberships.map(async (membership) => {
          const user = await ctx.db.get(membership.userId);
          return user ? mapUser(user) : null;
        }),
      )
    ).filter((user): user is NonNullable<typeof user> => user !== null);

    return {
      project: mapProject(project),
      release: {
        ...mapReleasePacket(release),
        pullRequestPublicIds: releasePullRequests
          .map((row) => pullRequestById.get(row.pullRequestId)?.publicId ?? null)
          .filter((value): value is string => value !== null),
        items: releaseItems.map((item) => ({
          id: item._id,
          title: item.title,
          details: item.details,
          kind: item.kind,
          status: item.status,
        })),
        participants: releaseParticipants.map((participant) => ({
          id: participant._id,
          userId: participant.userId ?? null,
          name: participant.name,
          email: participant.email ?? null,
          role: participant.role,
          status: participant.status,
          notes: participant.notes,
        })),
        dependencies: dependencies.map((dependency) => ({
          id: dependency._id,
          blockingPullRequestPublicId:
            pullRequestById.get(dependency.blockingPullRequestId)?.publicId ?? "",
          blockedPullRequestPublicId:
            pullRequestById.get(dependency.blockedPullRequestId)?.publicId ?? "",
        })),
      },
      repositories: repositories.map(mapRepository),
      pullRequests: pullRequests.map((pullRequest) =>
        mapPullRequest(
          pullRequest,
          pullRequest.repositoryId
            ? repositoryById.get(pullRequest.repositoryId)?.publicId ?? null
            : null,
        ),
      ),
      orgUsers,
    };
  },
});

export const updateRelease = mutation({
  args: {
    releasePublicId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("shipped"),
        v.literal("blocked"),
      ),
    ),
    outcome: v.optional(v.string()),
    successMetric: v.optional(v.string()),
    shipPlan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);

    await ctx.db.patch(release._id, {
      name: args.name ?? release.name,
      description: args.description ?? release.description,
      status: args.status ?? release.status,
      outcome: args.outcome ?? release.outcome,
      successMetric: args.successMetric ?? release.successMetric,
      shipPlan: args.shipPlan ?? release.shipPlan,
      updatedAt: now(),
    });

    return mapReleasePacket((await getReleaseById(ctx, release._id))!);
  },
});

export const addReleaseItem = mutation({
  args: {
    releasePublicId: v.string(),
    title: v.string(),
    details: v.optional(v.string()),
    kind: v.optional(
      v.union(v.literal("task"), v.literal("risk"), v.literal("note")),
    ),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const timestamp = now();

    const itemId = await ctx.db.insert("releaseItems", {
      releasePacketId: release._id,
      title: args.title,
      details: args.details ?? "",
      kind: args.kind ?? "task",
      status: "todo",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const item = (await ctx.db.get(itemId))!;
    return {
      id: item._id,
      title: item.title,
      details: item.details,
      kind: item.kind,
      status: item.status,
    };
  },
});

export const updateReleaseItem = mutation({
  args: {
    releasePublicId: v.string(),
    itemId: v.id("releaseItems"),
    title: v.optional(v.string()),
    details: v.optional(v.string()),
    kind: v.optional(
      v.union(v.literal("task"), v.literal("risk"), v.literal("note")),
    ),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    ),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.releasePacketId !== release._id) {
      throw new Error("Release item not found.");
    }

    await ctx.db.patch(item._id, {
      title: args.title ?? item.title,
      details: args.details ?? item.details,
      kind: args.kind ?? item.kind,
      status: args.status ?? item.status,
      updatedAt: now(),
    });

    const updated = (await ctx.db.get(item._id))!;
    return {
      id: updated._id,
      title: updated.title,
      details: updated.details,
      kind: updated.kind,
      status: updated.status,
    };
  },
});

export const removeReleaseItem = mutation({
  args: { releasePublicId: v.string(), itemId: v.id("releaseItems") },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.releasePacketId !== release._id) {
      throw new Error("Release item not found.");
    }
    await ctx.db.delete(item._id);
    return null;
  },
});

export const addReleaseParticipant = mutation({
  args: {
    releasePublicId: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const timestamp = now();
    const participantId = await ctx.db.insert("releaseParticipants", {
      releasePacketId: release._id,
      userId: args.userId,
      name: args.name,
      email: args.email,
      role: args.role,
      status: "pending",
      notes: args.notes ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const participant = (await ctx.db.get(participantId))!;
    return {
      id: participant._id,
      userId: participant.userId ?? null,
      name: participant.name,
      email: participant.email ?? null,
      role: participant.role,
      status: participant.status,
      notes: participant.notes,
    };
  },
});

export const updateReleaseParticipant = mutation({
  args: {
    releasePublicId: v.string(),
    participantId: v.id("releaseParticipants"),
    role: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("complete"),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.releasePacketId !== release._id) {
      throw new Error("Release participant not found.");
    }

    await ctx.db.patch(participant._id, {
      role: args.role ?? participant.role,
      status: args.status ?? participant.status,
      notes: args.notes ?? participant.notes,
      updatedAt: now(),
    });

    const updated = (await ctx.db.get(participant._id))!;
    return {
      id: updated._id,
      userId: updated.userId ?? null,
      name: updated.name,
      email: updated.email ?? null,
      role: updated.role,
      status: updated.status,
      notes: updated.notes,
    };
  },
});

export const removeReleaseParticipant = mutation({
  args: {
    releasePublicId: v.string(),
    participantId: v.id("releaseParticipants"),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.releasePacketId !== release._id) {
      throw new Error("Release participant not found.");
    }
    await ctx.db.delete(participant._id);
    return null;
  },
});

export const attachPullRequestToRelease = mutation({
  args: {
    releasePublicId: v.string(),
    pullRequestPublicId: v.string(),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const pullRequest = await getPullRequestByPublicId(ctx, args.pullRequestPublicId);
    if (!pullRequest || pullRequest.projectId !== release.projectId) {
      throw new Error("Pull request not found.");
    }

    const existing = await ctx.db
      .query("releasePacketPullRequests")
      .withIndex("by_release_packet_id_and_pull_request_id", (q) =>
        q.eq("releasePacketId", release._id).eq("pullRequestId", pullRequest._id),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("releasePacketPullRequests", {
        releasePacketId: release._id,
        pullRequestId: pullRequest._id,
        createdAt: now(),
      });
    }

    return null;
  },
});

export const detachPullRequestFromRelease = mutation({
  args: {
    releasePublicId: v.string(),
    pullRequestPublicId: v.string(),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const pullRequest = await getPullRequestByPublicId(ctx, args.pullRequestPublicId);
    if (!pullRequest) {
      throw new Error("Pull request not found.");
    }

    const row = await ctx.db
      .query("releasePacketPullRequests")
      .withIndex("by_release_packet_id_and_pull_request_id", (q) =>
        q.eq("releasePacketId", release._id).eq("pullRequestId", pullRequest._id),
      )
      .unique();

    if (row) {
      await ctx.db.delete(row._id);
    }

    for (const dependency of await ctx.db
      .query("releaseDependencies")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100)) {
      if (
        dependency.blockingPullRequestId === pullRequest._id ||
        dependency.blockedPullRequestId === pullRequest._id
      ) {
        await ctx.db.delete(dependency._id);
      }
    }

    return null;
  },
});

export const addReleaseDependency = mutation({
  args: {
    releasePublicId: v.string(),
    blockingPullRequestPublicId: v.string(),
    blockedPullRequestPublicId: v.string(),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const [blocking, blocked] = await Promise.all([
      getPullRequestByPublicId(ctx, args.blockingPullRequestPublicId),
      getPullRequestByPublicId(ctx, args.blockedPullRequestPublicId),
    ]);

    if (!blocking || !blocked) {
      throw new Error("Pull requests not found.");
    }

    const existing = await ctx.db
      .query("releaseDependencies")
      .withIndex("by_release_packet_id", (q) =>
        q.eq("releasePacketId", release._id),
      )
      .take(100);

    if (
      existing.some(
        (dependency) =>
          dependency.blockingPullRequestId === blocking._id &&
          dependency.blockedPullRequestId === blocked._id,
      )
    ) {
      return null;
    }

    await ctx.db.insert("releaseDependencies", {
      releasePacketId: release._id,
      blockingPullRequestId: blocking._id,
      blockedPullRequestId: blocked._id,
      createdAt: now(),
    });

    return null;
  },
});

export const removeReleaseDependency = mutation({
  args: {
    releasePublicId: v.string(),
    dependencyId: v.id("releaseDependencies"),
  },
  handler: async (ctx, args) => {
    const { release } = await requireReleaseAccess(ctx, args.releasePublicId);
    const dependency = await ctx.db.get(args.dependencyId);
    if (!dependency || dependency.releasePacketId !== release._id) {
      throw new Error("Dependency not found.");
    }
    await ctx.db.delete(dependency._id);
    return null;
  },
});
