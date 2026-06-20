import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    workosUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_workos_user_id", ["workosUserId"]),

  organizations: defineTable({
    workosOrgId: v.string(),
    name: v.string(),
    allocatedPlanId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workos_org_id", ["workosOrgId"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.string(),
    joinedAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_user_id", ["userId"])
    .index("by_organization_id_and_user_id", ["organizationId", "userId"]),

  projects: defineTable({
    orgId: v.id("organizations"),
    publicId: v.string(),
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_id", ["orgId"])
    .index("by_public_id", ["publicId"]),

  repositories: defineTable({
    projectId: v.id("projects"),
    publicId: v.string(),
    repoVendor: v.string(),
    repoOwner: v.string(),
    repoName: v.string(),
    defaultBranch: v.optional(v.string()),
    installationStatus: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_public_id", ["publicId"])
    .index("by_repo_owner_and_name", ["repoOwner", "repoName"]),

  pullRequests: defineTable({
    projectId: v.id("projects"),
    repositoryId: v.optional(v.id("repositories")),
    publicId: v.string(),
    number: v.optional(v.number()),
    title: v.string(),
    status: v.string(),
    url: v.optional(v.string()),
    authorName: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    headBranch: v.optional(v.string()),
    mergedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_repository_id", ["repositoryId"])
    .index("by_repository_id_and_number", ["repositoryId", "number"])
    .index("by_public_id", ["publicId"]),

  releasePackets: defineTable({
    projectId: v.id("projects"),
    publicId: v.string(),
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("shipped"),
      v.literal("blocked"),
    ),
    outcome: v.string(),
    successMetric: v.string(),
    shipPlan: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_public_id", ["publicId"]),

  releaseItems: defineTable({
    releasePacketId: v.id("releasePackets"),
    title: v.string(),
    details: v.string(),
    kind: v.union(v.literal("task"), v.literal("risk"), v.literal("note")),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  releaseParticipants: defineTable({
    releasePacketId: v.id("releasePackets"),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("complete"),
    ),
    notes: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  releasePacketPullRequests: defineTable({
    releasePacketId: v.id("releasePackets"),
    pullRequestId: v.id("pullRequests"),
    createdAt: v.number(),
  })
    .index("by_release_packet_id", ["releasePacketId"])
    .index("by_pull_request_id", ["pullRequestId"])
    .index("by_release_packet_id_and_pull_request_id", [
      "releasePacketId",
      "pullRequestId",
    ]),

  releaseDependencies: defineTable({
    releasePacketId: v.id("releasePackets"),
    blockingPullRequestId: v.id("pullRequests"),
    blockedPullRequestId: v.id("pullRequests"),
    createdAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  githubInstallations: defineTable({
    installationId: v.number(),
    accountLogin: v.string(),
    status: v.string(),
    selectedProjectId: v.optional(v.id("projects")),
    createdAt: v.number(),
    updatedAt: v.number(),
    appliedAt: v.optional(v.number()),
  }).index("by_installation_id", ["installationId"]),

  githubInstallationRepositories: defineTable({
    githubInstallationId: v.id("githubInstallations"),
    repoOwner: v.string(),
    repoName: v.string(),
    isPrivate: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_github_installation_id", ["githubInstallationId"])
    .index("by_repo_owner_and_name", ["repoOwner", "repoName"]),
});
