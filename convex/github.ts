import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

function createPublicId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function mapPrStatus(state: string, merged: boolean): string {
  if (merged) return "merged";
  if (state === "closed") return "closed";
  return "open";
}

export const processPullRequestEvent = internalMutation({
  args: {
    action: v.string(),
    number: v.number(),
    title: v.string(),
    url: v.string(),
    state: v.string(),
    merged: v.boolean(),
    mergedAt: v.union(v.string(), v.null()),
    authorName: v.union(v.string(), v.null()),
    baseBranch: v.string(),
    headBranch: v.string(),
    repoOwner: v.string(),
    repoName: v.string(),
    defaultBranch: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    console.log("Received pull request event: ", args);
    let repo = await ctx.db
      .query("repositories")
      .withIndex("by_repo_owner_and_name", (q) =>
        q.eq("repoOwner", args.repoOwner).eq("repoName", args.repoName),
      )
      .first();

    if (!repo) {
      const projects = await ctx.db.query("projects").take(2);

      if (projects.length !== 1) {
        throw new Error(
          `Missing repository details for ${args.repoOwner}/${args.repoName} and unable to infer a single project to attach it to.`,
        );
      }

      const timestamp = Date.now();
      const repositoryId = await ctx.db.insert("repositories", {
        projectId: projects[0]._id,
        publicId: createPublicId("repo"),
        repoVendor: "github",
        repoOwner: args.repoOwner,
        repoName: args.repoName,
        defaultBranch: args.defaultBranch ?? undefined,
        installationStatus: "webhook",
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      repo = (await ctx.db.get(repositoryId))!;
    }

    const status = mapPrStatus(args.state, args.merged);
    const mergedAt = args.mergedAt
      ? new Date(args.mergedAt).getTime()
      : undefined;
    const timestamp = Date.now();

    const existing = await ctx.db
      .query("pullRequests")
      .withIndex("by_repository_id_and_number", (q) =>
        q.eq("repositoryId", repo._id).eq("number", args.number),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        status,
        url: args.url,
        authorName: args.authorName ?? undefined,
        baseBranch: args.baseBranch,
        headBranch: args.headBranch,
        mergedAt,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("pullRequests", {
        projectId: repo.projectId,
        repositoryId: repo._id,
        publicId: createPublicId("pr"),
        number: args.number,
        title: args.title,
        status,
        url: args.url,
        authorName: args.authorName ?? undefined,
        baseBranch: args.baseBranch,
        headBranch: args.headBranch,
        mergedAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return null;
  },
});

export const processInstallationEvent = internalMutation({
  args: {
    action: v.string(),
    installationId: v.number(),
    accountLogin: v.string(),
    repositories: v.array(
      v.object({
        repoOwner: v.string(),
        repoName: v.string(),
        isPrivate: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    console.log("Received installation event: ", args);
    const timestamp = Date.now();
    let installation = await ctx.db
      .query("githubInstallations")
      .withIndex("by_installation_id", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();

    if (installation) {
      await ctx.db.patch(installation._id, {
        accountLogin: args.accountLogin,
        status: "pending",
        updatedAt: timestamp,
      });
      installation = (await ctx.db.get(installation._id))!;
    } else {
      const installationDocId = await ctx.db.insert("githubInstallations", {
        installationId: args.installationId,
        accountLogin: args.accountLogin,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      installation = (await ctx.db.get(installationDocId))!;
    }

    const existingRepositories = await ctx.db
      .query("githubInstallationRepositories")
      .withIndex("by_github_installation_id", (q) =>
        q.eq("githubInstallationId", installation._id),
      )
      .take(500);

    for (const existingRepository of existingRepositories) {
      await ctx.db.delete(existingRepository._id);
    }

    for (const repository of args.repositories) {
      await ctx.db.insert("githubInstallationRepositories", {
        githubInstallationId: installation._id,
        repoOwner: repository.repoOwner,
        repoName: repository.repoName,
        isPrivate: repository.isPrivate,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return null;
  },
});
