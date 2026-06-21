import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    workosUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    defaultWorkosOrgId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_workos_user_id", ["workosUserId"]),

  userAuthIdentities: defineTable({
    userId: v.id("users"),
    tokenIdentifier: v.string(),
    issuer: v.string(),
    subject: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_user_id", ["userId"]),

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
      v.literal("awaiting_approvals"),
      v.literal("approved"),
      v.literal("merging"),
      v.literal("merged"),
      v.literal("monitoring"),
      v.literal("completed"),
      v.literal("alerted"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("shipped"),
      v.literal("blocked"),
    ),
    outcome: v.string(),
    successMetric: v.string(),
    shipPlan: v.string(),
    targetEnvironment: v.optional(v.string()),
    approvalSummary: v.optional(v.string()),
    riskSummary: v.optional(v.string()),
    monitorWindowMinutes: v.optional(v.number()),
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

  releaseApprovals: defineTable({
    releasePacketId: v.id("releasePackets"),
    requestPublicId: v.string(),
    approverName: v.string(),
    approverEmail: v.optional(v.string()),
    approverRole: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),
    source: v.union(
      v.literal("mcp"),
      v.literal("slack"),
      v.literal("system"),
    ),
    actionToken: v.string(),
    slackUserId: v.optional(v.string()),
    decisionComment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_release_packet_id", ["releasePacketId"])
    .index("by_action_token", ["actionToken"])
    .index("by_request_public_id", ["requestPublicId"]),

  releaseExecutionRuns: defineTable({
    releasePacketId: v.id("releasePackets"),
    triggeredByUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("needs_configuration"),
    ),
    mergePolicy: v.string(),
    totalPullRequests: v.number(),
    mergedPullRequests: v.number(),
    failedPullRequests: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    errorSummary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  releaseExecutionItems: defineTable({
    executionRunId: v.id("releaseExecutionRuns"),
    pullRequestId: v.id("pullRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("merged"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    errorMessage: v.optional(v.string()),
    mergedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_execution_run_id", ["executionRunId"])
    .index("by_pull_request_id", ["pullRequestId"]),

  releaseMonitoringSessions: defineTable({
    releasePacketId: v.id("releasePackets"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("healthy"),
      v.literal("alerted"),
      v.literal("completed"),
      v.literal("needs_configuration"),
      v.literal("failed"),
    ),
    metricName: v.string(),
    baselineValue: v.optional(v.number()),
    latestValue: v.optional(v.number()),
    thresholdPercent: v.number(),
    monitorWindowMinutes: v.number(),
    pollIntervalMinutes: v.number(),
    startedAt: v.number(),
    endsAt: v.number(),
    completedAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    alertCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  releaseMonitoringSnapshots: defineTable({
    monitoringSessionId: v.id("releaseMonitoringSessions"),
    kind: v.union(v.literal("baseline"), v.literal("sample")),
    metricName: v.string(),
    value: v.number(),
    status: v.union(
      v.literal("ok"),
      v.literal("breached"),
      v.literal("missing"),
    ),
    observedAt: v.number(),
    rawPayload: v.optional(v.string()),
  }).index("by_monitoring_session_id", ["monitoringSessionId"]),

  projectIntegrations: defineTable({
    projectId: v.id("projects"),
    kind: v.union(
      v.literal("github"),
      v.literal("slack"),
      v.literal("grafana"),
      v.literal("vercel"),
    ),
    status: v.union(v.literal("active"), v.literal("inactive")),
    slackIncomingWebhookUrl: v.optional(v.string()),
    slackDefaultChannel: v.optional(v.string()),
    githubToken: v.optional(v.string()),
    githubInstallUrl: v.optional(v.string()),
    grafanaEndpointUrl: v.optional(v.string()),
    grafanaApiToken: v.optional(v.string()),
    grafanaMetricName: v.optional(v.string()),
    grafanaAlertThresholdPercent: v.optional(v.number()),
    vercelAccessTokenCiphertext: v.optional(v.string()),
    vercelRefreshTokenCiphertext: v.optional(v.string()),
    vercelTokenScope: v.optional(v.string()),
    vercelAccessTokenExpiresAt: v.optional(v.number()),
    vercelUserId: v.optional(v.string()),
    vercelUserEmail: v.optional(v.string()),
    vercelUserName: v.optional(v.string()),
    vercelUserAvatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_project_id_and_kind", ["projectId", "kind"]),

  organizationBillingAccounts: defineTable({
    organizationId: v.id("organizations"),
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
    lastCheckoutAt: v.optional(v.number()),
    currentPeriodEndsAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_organization_id_and_provider", ["organizationId", "provider"]),

  billingEvents: defineTable({
    organizationId: v.id("organizations"),
    provider: v.union(v.literal("paddle"), v.literal("polar")),
    kind: v.string(),
    externalId: v.optional(v.string()),
    payloadJson: v.string(),
    processedAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_provider", ["provider"]),

  onboardingStates: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("blocked"),
    ),
    currentStep: v.string(),
    completedSteps: v.array(v.string()),
    pendingBrowserStep: v.optional(v.string()),
    continuationToken: v.optional(v.string()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_organization_id", ["organizationId"]),

  releaseNotifications: defineTable({
    releasePacketId: v.id("releasePackets"),
    kind: v.union(
      v.literal("approval_request"),
      v.literal("approval_reminder"),
      v.literal("status_update"),
      v.literal("monitoring_alert"),
      v.literal("monitoring_summary"),
    ),
    destination: v.union(
      v.literal("slack"),
      v.literal("mcp"),
      v.literal("system"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    payloadJson: v.string(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_release_packet_id", ["releasePacketId"]),

  releaseEvents: defineTable({
    releasePacketId: v.id("releasePackets"),
    actorUserId: v.optional(v.id("users")),
    source: v.union(
      v.literal("mcp"),
      v.literal("slack"),
      v.literal("github"),
      v.literal("monitoring"),
      v.literal("system"),
    ),
    kind: v.string(),
    summary: v.string(),
    payloadJson: v.optional(v.string()),
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
