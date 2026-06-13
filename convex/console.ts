import {
  internalMutationGeneric as mutation,
  internalQueryGeneric as query,
} from "convex/server";
import { v } from "convex/values";

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

async function getUserByWorkosUserId(ctx: any, workosUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q: any) => q.eq("workosUserId", workosUserId))
    .unique();
}

async function getOrganizationByWorkosOrgId(ctx: any, workosOrgId: string) {
  return await ctx.db
    .query("organizations")
    .withIndex("by_workos_org_id", (q: any) => q.eq("workosOrgId", workosOrgId))
    .unique();
}

async function getProjectByPublicId(ctx: any, publicId: string) {
  return await ctx.db
    .query("projects")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .unique();
}

async function getRepositoryByPublicId(ctx: any, publicId: string) {
  return await ctx.db
    .query("repositories")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .unique();
}

async function getPullRequestByPublicId(ctx: any, publicId: string) {
  return await ctx.db
    .query("pullRequests")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .unique();
}

async function getReleaseByPublicId(ctx: any, publicId: string) {
  return await ctx.db
    .query("releasePackets")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .unique();
}

function mapUser(user: any) {
  return {
    workosUserId: user.workosUserId,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  };
}

function mapOrg(org: any) {
  return {
    id: org._id,
    workosOrgId: org.workosOrgId,
    name: org.name,
    allocatedPlanId: org.allocatedPlanId ?? null,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

function mapProject(project: any) {
  return {
    id: project._id,
    publicId: project.publicId,
    orgId: project.orgId,
    name: project.name,
    slug: project.slug,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function mapRepo(repo: any) {
  return {
    id: repo._id,
    publicId: repo.publicId,
    projectId: repo.projectId,
    repoVendor: repo.repoVendor,
    repoOwner: repo.repoOwner,
    repoName: repo.repoName,
    defaultBranch: repo.defaultBranch ?? null,
    installationStatus: repo.installationStatus ?? null,
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
  };
}

function mapPullRequest(pr: any) {
  return {
    id: pr._id,
    publicId: pr.publicId,
    projectId: pr.projectId,
    repositoryPublicId: pr.repositoryPublicId ?? null,
    number: pr.number ?? null,
    title: pr.title,
    status: pr.status,
    url: pr.url ?? null,
    authorName: pr.authorName ?? null,
    baseBranch: pr.baseBranch ?? null,
    headBranch: pr.headBranch ?? null,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    mergedAt: pr.mergedAt ?? null,
  };
}

function mapRelease(release: any) {
  return {
    id: release._id,
    publicId: release.publicId,
    projectId: release.projectId,
    name: release.name,
    description: release.description,
    status: release.status,
    outcome: release.outcome,
    successMetric: release.successMetric,
    shipPlan: release.shipPlan,
    pullRequestPublicIds: release.pullRequestPublicIds,
    items: release.items,
    participants: release.participants,
    dependencies: release.dependencies,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
  };
}

export const syncSession = mutation({
  args: {
    user: v.object({
      workosUserId: v.string(),
      email: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
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
    const timestamp = now();
    let user = await getUserByWorkosUserId(ctx, args.user.workosUserId);

    if (user) {
      await ctx.db.patch(user._id, {
        email: args.user.email,
        firstName: args.user.firstName,
        lastName: args.user.lastName,
        updatedAt: timestamp,
      });
      user = await ctx.db.get(user._id);
    } else {
      const userId = await ctx.db.insert("users", {
        ...args.user,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      user = await ctx.db.get(userId);
    }

    if (!args.organization || !user) return null;

    let organization = await getOrganizationByWorkosOrgId(
      ctx,
      args.organization.workosOrgId,
    );

    if (organization) {
      await ctx.db.patch(organization._id, {
        name: args.organization.name,
        updatedAt: timestamp,
      });
      organization = await ctx.db.get(organization._id);
    } else {
      const organizationId = await ctx.db.insert("organizations", {
        workosOrgId: args.organization.workosOrgId,
        name: args.organization.name,
        allocatedPlanId: "starter",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      organization = await ctx.db.get(organizationId);
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_id", (q: any) =>
        q.eq("organizationId", organization._id),
      )
      .collect()
      .then((rows: any[]) => rows.find((row) => row.userId === user._id));

    if (!membership) {
      await ctx.db.insert("memberships", {
        organizationId: organization._id,
        userId: user._id,
        role: "admin",
        joinedAt: timestamp,
      });
    }

    return null;
  },
});

export const createOrganization = mutation({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
    userWorkosId: v.string(),
  },
  handler: async (ctx, args) => {
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
      organization = await ctx.db.get(organizationId);
    }

    const user = await getUserByWorkosUserId(ctx, args.userWorkosId);
    if (user) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_organization_id", (q: any) =>
          q.eq("organizationId", organization._id),
        )
        .collect()
        .then((rows: any[]) => rows.find((row) => row.userId === user._id));

      if (!membership) {
        await ctx.db.insert("memberships", {
          organizationId: organization._id,
          userId: user._id,
          role: "admin",
          joinedAt: timestamp,
        });
      }
    }

    return mapOrg(organization);
  },
});

export const getOrgDashboard = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const org = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!org) return { org: null, projects: [] };

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q: any) => q.eq("orgId", org._id))
      .collect();

    return {
      org: mapOrg(org),
      projects: projects
        .map(mapProject)
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt),
    };
  },
});

export const createProject = mutation({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationByWorkosOrgId(ctx, args.workosOrgId);
    if (!org) {
      throw new Error("Organization not found.");
    }

    const timestamp = now();
    const publicId = createPublicId("proj");
    const projectId = await ctx.db.insert("projects", {
      orgId: org._id,
      publicId,
      name: args.name,
      slug: slugify(args.name) || publicId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const project = await ctx.db.get(projectId);
    return mapProject(project);
  },
});

export const getProjectOverview = query({
  args: { projectPublicId: v.string() },
  handler: async (ctx, args) => {
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    if (!project) {
      return { project: null, repositories: [], pullRequests: [] };
    }

    const [repositories, pullRequests] = await Promise.all([
      ctx.db
        .query("repositories")
        .withIndex("by_project_id", (q: any) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("pullRequests")
        .withIndex("by_project_id", (q: any) => q.eq("projectId", project._id))
        .collect(),
    ]);

    return {
      project: mapProject(project),
      repositories: repositories
        .map(mapRepo)
        .sort((a: any, b: any) => a.repoName.localeCompare(b.repoName)),
      pullRequests: pullRequests
        .map(mapPullRequest)
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt),
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
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    if (!project) throw new Error("Project not found.");

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

    return mapRepo(await ctx.db.get(repositoryId));
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
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    if (!project) throw new Error("Project not found.");

    if (args.repositoryPublicId) {
      const repository = await getRepositoryByPublicId(ctx, args.repositoryPublicId);
      if (!repository) throw new Error("Repository not found.");
    }

    const timestamp = now();
    const pullRequestId = await ctx.db.insert("pullRequests", {
      projectId: project._id,
      publicId: createPublicId("pr"),
      repositoryPublicId: args.repositoryPublicId,
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

    return mapPullRequest(await ctx.db.get(pullRequestId));
  },
});

export const getProjectReleases = query({
  args: { projectPublicId: v.string() },
  handler: async (ctx, args) => {
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    if (!project) return { project: null, releases: [] };

    const releases = await ctx.db
      .query("releasePackets")
      .withIndex("by_project_id", (q: any) => q.eq("projectId", project._id))
      .collect();

    return {
      project: mapProject(project),
      releases: releases
        .map(mapRelease)
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt),
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
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    if (!project) throw new Error("Project not found.");

    const timestamp = now();
    const releaseId = await ctx.db.insert("releasePackets", {
      projectId: project._id,
      publicId: createPublicId("rel"),
      name: args.name,
      description: args.description ?? "",
      status: "draft",
      outcome: "",
      successMetric: "",
      shipPlan: "",
      pullRequestPublicIds: [],
      items: [],
      participants: [],
      dependencies: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return mapRelease(await ctx.db.get(releaseId));
  },
});

export const deleteRelease = mutation({
  args: { releasePublicId: v.string() },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");
    await ctx.db.delete(release._id);
    return null;
  },
});

export const getReleaseDetail = query({
  args: {
    projectPublicId: v.string(),
    releasePublicId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProjectByPublicId(ctx, args.projectPublicId);
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);

    if (!project || !release || release.projectId !== project._id) {
      return {
        project: null,
        release: null,
        repositories: [],
        pullRequests: [],
        orgUsers: [],
      };
    }

    const [repositories, pullRequests, memberships] = await Promise.all([
      ctx.db
        .query("repositories")
        .withIndex("by_project_id", (q: any) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("pullRequests")
        .withIndex("by_project_id", (q: any) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_organization_id", (q: any) => q.eq("organizationId", project.orgId))
        .collect(),
    ]);

    const orgUsers = await Promise.all(
      memberships.map(async (membership: any) => mapUser(await ctx.db.get(membership.userId))),
    );

    return {
      project: mapProject(project),
      release: mapRelease(release),
      repositories: repositories.map(mapRepo),
      pullRequests: pullRequests.map(mapPullRequest),
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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    await ctx.db.patch(release._id, {
      name: args.name ?? release.name,
      description: args.description ?? release.description,
      status: args.status ?? release.status,
      outcome: args.outcome ?? release.outcome,
      successMetric: args.successMetric ?? release.successMetric,
      shipPlan: args.shipPlan ?? release.shipPlan,
      updatedAt: now(),
    });

    return mapRelease(await ctx.db.get(release._id));
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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    const item = {
      id: createPublicId("item"),
      title: args.title,
      details: args.details ?? "",
      kind: args.kind ?? "task",
      status: "todo",
    };

    await ctx.db.patch(release._id, {
      items: [...release.items, item],
      updatedAt: now(),
    });

    return item;
  },
});

export const updateReleaseItem = mutation({
  args: {
    releasePublicId: v.string(),
    itemId: v.string(),
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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    const items = release.items.map((item: any) =>
      item.id === args.itemId
        ? {
            ...item,
            title: args.title ?? item.title,
            details: args.details ?? item.details,
            kind: args.kind ?? item.kind,
            status: args.status ?? item.status,
          }
        : item,
    );

    await ctx.db.patch(release._id, { items, updatedAt: now() });
    return items.find((item: any) => item.id === args.itemId) ?? null;
  },
});

export const removeReleaseItem = mutation({
  args: { releasePublicId: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    await ctx.db.patch(release._id, {
      items: release.items.filter((item: any) => item.id !== args.itemId),
      updatedAt: now(),
    });

    return null;
  },
});

export const addReleaseParticipant = mutation({
  args: {
    releasePublicId: v.string(),
    userId: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    const participant = {
      id: createPublicId("part"),
      userId: args.userId,
      name: args.name,
      email: args.email,
      role: args.role,
      status: "pending",
      notes: args.notes ?? "",
    };

    await ctx.db.patch(release._id, {
      participants: [...release.participants, participant],
      updatedAt: now(),
    });

    return participant;
  },
});

export const updateReleaseParticipant = mutation({
  args: {
    releasePublicId: v.string(),
    participantId: v.string(),
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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    const participants = release.participants.map((participant: any) =>
      participant.id === args.participantId
        ? {
            ...participant,
            role: args.role ?? participant.role,
            status: args.status ?? participant.status,
            notes: args.notes ?? participant.notes,
          }
        : participant,
    );

    await ctx.db.patch(release._id, {
      participants,
      updatedAt: now(),
    });

    return participants.find((participant: any) => participant.id === args.participantId) ?? null;
  },
});

export const removeReleaseParticipant = mutation({
  args: { releasePublicId: v.string(), participantId: v.string() },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    await ctx.db.patch(release._id, {
      participants: release.participants.filter(
        (participant: any) => participant.id !== args.participantId,
      ),
      updatedAt: now(),
    });

    return null;
  },
});

export const attachPullRequestToRelease = mutation({
  args: {
    releasePublicId: v.string(),
    pullRequestPublicId: v.string(),
  },
  handler: async (ctx, args) => {
    const [release, pullRequest] = await Promise.all([
      getReleaseByPublicId(ctx, args.releasePublicId),
      getPullRequestByPublicId(ctx, args.pullRequestPublicId),
    ]);
    if (!release || !pullRequest) throw new Error("Release or pull request not found.");

    if (!release.pullRequestPublicIds.includes(args.pullRequestPublicId)) {
      await ctx.db.patch(release._id, {
        pullRequestPublicIds: [
          ...release.pullRequestPublicIds,
          args.pullRequestPublicId,
        ],
        updatedAt: now(),
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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    await ctx.db.patch(release._id, {
      pullRequestPublicIds: release.pullRequestPublicIds.filter(
        (value: string) => value !== args.pullRequestPublicId,
      ),
      dependencies: release.dependencies.filter(
        (dependency: any) =>
          dependency.blockingPullRequestPublicId !== args.pullRequestPublicId &&
          dependency.blockedPullRequestPublicId !== args.pullRequestPublicId,
      ),
      updatedAt: now(),
    });

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
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    if (
      release.dependencies.some(
        (dependency: any) =>
          dependency.blockingPullRequestPublicId === args.blockingPullRequestPublicId &&
          dependency.blockedPullRequestPublicId === args.blockedPullRequestPublicId,
      )
    ) {
      return null;
    }

    await ctx.db.patch(release._id, {
      dependencies: [
        ...release.dependencies,
        {
          id: createPublicId("dep"),
          blockingPullRequestPublicId: args.blockingPullRequestPublicId,
          blockedPullRequestPublicId: args.blockedPullRequestPublicId,
        },
      ],
      updatedAt: now(),
    });

    return null;
  },
});

export const removeReleaseDependency = mutation({
  args: {
    releasePublicId: v.string(),
    dependencyId: v.string(),
  },
  handler: async (ctx, args) => {
    const release = await getReleaseByPublicId(ctx, args.releasePublicId);
    if (!release) throw new Error("Release not found.");

    await ctx.db.patch(release._id, {
      dependencies: release.dependencies.filter(
        (dependency: any) => dependency.id !== args.dependencyId,
      ),
      updatedAt: now(),
    });

    return null;
  },
});
