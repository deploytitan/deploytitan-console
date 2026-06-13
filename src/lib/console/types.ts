export type ReleaseStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "shipped"
  | "blocked";

export type ReleaseItemKind = "task" | "risk" | "note";

export type ReleaseItemStatus = "todo" | "doing" | "done";

export type ReleaseParticipantStatus = "pending" | "confirmed" | "complete";

export interface ConsoleUser {
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface OrganizationSummary {
  id: string;
  workosOrgId: string;
  name: string;
  allocatedPlanId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  publicId: string;
  orgId: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
}

export interface RepositorySummary {
  id: string;
  publicId: string;
  projectId: string;
  repoVendor: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string | null;
  installationStatus: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PullRequestSummary {
  id: string;
  publicId: string;
  projectId: string;
  repositoryPublicId: string | null;
  number: number | null;
  title: string;
  status: string;
  url: string | null;
  authorName: string | null;
  baseBranch: string | null;
  headBranch: string | null;
  createdAt: number;
  updatedAt: number;
  mergedAt: number | null;
}

export interface ReleaseItemSummary {
  id: string;
  title: string;
  details: string;
  kind: ReleaseItemKind;
  status: ReleaseItemStatus;
}

export interface ReleaseParticipantSummary {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  role: string;
  status: ReleaseParticipantStatus;
  notes: string;
}

export interface ReleaseDependencySummary {
  id: string;
  blockingPullRequestPublicId: string;
  blockedPullRequestPublicId: string;
}

export interface ReleasePacketSummary {
  id: string;
  publicId: string;
  projectId: string;
  name: string;
  description: string;
  status: ReleaseStatus;
  outcome: string;
  successMetric: string;
  shipPlan: string;
  pullRequestPublicIds: string[];
  items: ReleaseItemSummary[];
  participants: ReleaseParticipantSummary[];
  dependencies: ReleaseDependencySummary[];
  createdAt: number;
  updatedAt: number;
}

export interface OrgDashboardResponse {
  org: OrganizationSummary | null;
  projects: ProjectSummary[];
}

export interface ProjectOverviewResponse {
  project: ProjectSummary | null;
  repositories: RepositorySummary[];
  pullRequests: PullRequestSummary[];
}

export interface ProjectReleasesResponse {
  project: ProjectSummary | null;
  releases: ReleasePacketSummary[];
}

export interface ReleaseDetailResponse {
  project: ProjectSummary | null;
  release: ReleasePacketSummary | null;
  repositories: RepositorySummary[];
  pullRequests: PullRequestSummary[];
  orgUsers: ConsoleUser[];
}
