export type PRMergeMethod = "merge" | "squash" | "rebase";

export interface MergePullRequestInput {
  repoId: string;
  pullNumber: number;
  headSha: string;
  installationId: number;
  mergeMethod?: PRMergeMethod;
}

export interface MergePullRequestResponse {
  pullRequestId: string;
  jobId: string;
  status: "queued";
}

export interface PullRequestStatusResponse {
  pullRequestId: string;
  prNumber: number;
  mergeStatus: string;
  mergeMethod: string;
  headSha: string;
  mergedAt: string | null;
  lastError: string | null;
  jobId: string | null;
}

export interface GitHubInstallUrlResponse {
  installUrl: string;
  state: string;
}

export interface GitHubInstallationSyncResponse {
  synced: boolean;
  repositories: number;
  pullRequests: number;
}

export function mergePullRequest(input: MergePullRequestInput) {
  return apiRequest<MergePullRequestResponse>("/pull-requests/merge", {
    method: "POST",
    json: input,
  });
}

export function getPullRequestStatus(repoId: string, prNumber: number) {
  return apiRequest<PullRequestStatusResponse>(
    `/pull-requests/${encodeURIComponent(repoId)}/${encodeURIComponent(String(prNumber))}/status`,
  );
}

export function getGitHubInstallUrl(input: {
  orgId?: string | null;
  projectId?: string | null;
  returnTo?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.orgId) params.set("orgId", input.orgId);
  if (input.projectId) params.set("projectId", input.projectId);
  if (input.returnTo) params.set("returnTo", input.returnTo);
  const query = params.toString();
  return apiRequest<GitHubInstallUrlResponse>(
    `/github/install-url${query ? `?${query}` : ""}`,
  );
}

export function syncGitHubInstallation(installationId: string | number) {
  return apiRequest<GitHubInstallationSyncResponse>(
    `/github/installations/${encodeURIComponent(String(installationId))}/sync`,
    { method: "POST" },
  );
}
