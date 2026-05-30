import axios from "axios";

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

export interface GitHubInstallCallbackResponse extends GitHubInstallationSyncResponse {
  installationId: number;
  setupAction: string | null;
  orgId: string | null;
  projectId: string | null;
  returnTo: string | null;
}

export function mergePullRequest(input: MergePullRequestInput) {
  return axios.post<MergePullRequestResponse>("/pull-requests/merge", input);
}

export function getPullRequestStatus(repoId: string, prNumber: number) {
  return axios.get<PullRequestStatusResponse>(
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
  return axios.get<GitHubInstallUrlResponse>(
    `/github/install-url${query ? `?${query}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Release packets
// ---------------------------------------------------------------------------

export interface MergeAllJobResult {
  pullRequestId: string;
  prNumber: number;
  jobId: string;
  status: "queued";
}

export interface MergeAllResponse {
  packetId: string;
  queued: number;
  jobs: MergeAllJobResult[];
}

export function mergeAllReleasePacket(packetId: string) {
  return axios.post<MergeAllResponse>(
    `/release-packets/${encodeURIComponent(packetId)}/merge-all`,
  );
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

export function syncGitHubInstallation(installationId: string | number) {
  return axios.post<GitHubInstallationSyncResponse>(
    `/github/installations/${encodeURIComponent(String(installationId))}/sync`,
  );
}

export function completeGitHubInstallation(input: {
  installationId: string;
  setupAction?: string | null;
  state?: string | null;
}) {
  return axios.get<GitHubInstallCallbackResponse>(
    `/api/github/install/callback`,
    {
      params: {
        installation_id: input.installationId,
        setup_action: input.setupAction,
        state: input.state,
      },
    },
  );
}
