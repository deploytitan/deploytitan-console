import type {
  OrgDashboardResponse,
  ProjectOverviewResponse,
  ProjectReleasesResponse,
  ReleaseDetailResponse,
  ProjectSummary,
  ReleasePacketSummary,
  RepositorySummary,
  PullRequestSummary,
} from "@/lib/console/types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getOrgDashboard(orgId: string) {
  return readJson<OrgDashboardResponse>(await fetch(`/api/console/orgs/${orgId}`));
}

export async function createProject(input: {
  orgId: string;
  name: string;
}) {
  return readJson<ProjectSummary>(
    await fetch(`/api/console/orgs/${input.orgId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name }),
    }),
  );
}

export async function getProjectOverview(projectId: string) {
  return readJson<ProjectOverviewResponse>(
    await fetch(`/api/console/projects/${projectId}/overview`),
  );
}

export async function createRepository(input: {
  projectId: string;
  repoOwner: string;
  repoName: string;
  defaultBranch?: string;
}) {
  return readJson<RepositorySummary>(
    await fetch(`/api/console/projects/${input.projectId}/repositories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function createPullRequest(input: {
  projectId: string;
  repositoryPublicId?: string;
  number?: number;
  title: string;
  url?: string;
  status?: string;
  authorName?: string;
  baseBranch?: string;
  headBranch?: string;
}) {
  return readJson<PullRequestSummary>(
    await fetch(`/api/console/projects/${input.projectId}/pull-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getProjectReleases(projectId: string) {
  return readJson<ProjectReleasesResponse>(
    await fetch(`/api/console/projects/${projectId}/releases`),
  );
}

export async function createRelease(input: {
  projectId: string;
  name: string;
  description?: string;
}) {
  return readJson<ReleasePacketSummary>(
    await fetch(`/api/console/projects/${input.projectId}/releases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRelease(releaseId: string) {
  await readJson<null>(
    await fetch(`/api/console/releases/${releaseId}`, { method: "DELETE" }),
  );
}

export async function getReleaseDetail(projectId: string, releaseId: string) {
  return readJson<ReleaseDetailResponse>(
    await fetch(
      `/api/console/releases/${releaseId}?projectId=${encodeURIComponent(projectId)}`,
    ),
  );
}

export async function updateRelease(
  releaseId: string,
  body: Record<string, unknown>,
) {
  return readJson<ReleasePacketSummary>(
    await fetch(`/api/console/releases/${releaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function addReleaseItem(
  releaseId: string,
  body: Record<string, unknown>,
) {
  return readJson(
    await fetch(`/api/console/releases/${releaseId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateReleaseItem(
  itemId: string,
  body: Record<string, unknown>,
) {
  return readJson(
    await fetch(`/api/console/release-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteReleaseItem(itemId: string, releaseId: string) {
  await readJson<null>(
    await fetch(`/api/console/release-items/${itemId}?releaseId=${releaseId}`, {
      method: "DELETE",
    }),
  );
}

export async function addReleaseParticipant(
  releaseId: string,
  body: Record<string, unknown>,
) {
  return readJson(
    await fetch(`/api/console/releases/${releaseId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateReleaseParticipant(
  participantId: string,
  body: Record<string, unknown>,
) {
  return readJson(
    await fetch(`/api/console/release-participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteReleaseParticipant(
  participantId: string,
  releaseId: string,
) {
  await readJson<null>(
    await fetch(
      `/api/console/release-participants/${participantId}?releaseId=${releaseId}`,
      { method: "DELETE" },
    ),
  );
}

export async function attachPullRequestToRelease(
  releaseId: string,
  pullRequestPublicId: string,
) {
  await readJson<null>(
    await fetch(`/api/console/releases/${releaseId}/pull-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pullRequestPublicId }),
    }),
  );
}

export async function detachPullRequestFromRelease(
  releaseId: string,
  pullRequestPublicId: string,
) {
  await readJson<null>(
    await fetch(`/api/console/releases/${releaseId}/pull-requests`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pullRequestPublicId }),
    }),
  );
}

export async function addReleaseDependency(
  releaseId: string,
  body: Record<string, unknown>,
) {
  await readJson<null>(
    await fetch(`/api/console/releases/${releaseId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteReleaseDependency(
  dependencyId: string,
  releaseId: string,
) {
  await readJson<null>(
    await fetch(`/api/console/dependencies/${dependencyId}?releaseId=${releaseId}`, {
      method: "DELETE",
    }),
  );
}
