import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const releaseItem = v.object({
  id: v.string(),
  title: v.string(),
  details: v.string(),
  kind: v.union(v.literal("task"), v.literal("risk"), v.literal("note")),
  status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
});

const releaseParticipant = v.object({
  id: v.string(),
  userId: v.optional(v.string()),
  name: v.string(),
  email: v.optional(v.string()),
  role: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("confirmed"),
    v.literal("complete"),
  ),
  notes: v.string(),
});

const releaseDependency = v.object({
  id: v.string(),
  blockingPullRequestPublicId: v.string(),
  blockedPullRequestPublicId: v.string(),
});

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workos_user_id", ["workosUserId"]),

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
    .index("by_user_id", ["userId"]),

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
    .index("by_public_id", ["publicId"]),

  pullRequests: defineTable({
    projectId: v.id("projects"),
    publicId: v.string(),
    repositoryPublicId: v.optional(v.string()),
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
    pullRequestPublicIds: v.array(v.string()),
    items: v.array(releaseItem),
    participants: v.array(releaseParticipant),
    dependencies: v.array(releaseDependency),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_public_id", ["publicId"]),
});
