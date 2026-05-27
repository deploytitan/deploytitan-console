/**
 * Centralized API client.
 *
 * All REST calls go through `apiRequest`. It automatically:
 *  - Resolves the base URL from NEXT_PUBLIC_API_URL
 *  - Attaches the Bearer token from shared browser storage when present
 *  - Throws an ApiError for non-2xx responses (includes status + body)
 *
 * Token storage keys are exported so every module uses the same constants.
 */

export { API_URL } from '../env'
import { API_URL } from '../env'

export const REFRESH_TOKEN_KEY = 'dt_refresh_token'
export const ACCESS_TOKEN_KEY = 'dt_access_token'

function safeRead(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage may be unavailable in some browser modes.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Storage may be unavailable in some browser modes.
  }
}

export function readAuthStorage(key: string): string | null {
  if (typeof window === 'undefined') return null

  const localValue = safeRead(window.localStorage, key)
  if (localValue) return localValue

  // Migrate legacy session-scoped auth into shared storage so duplicated tabs
  // and freshly opened tabs resolve the same authenticated session.
  const sessionValue = safeRead(window.sessionStorage, key)
  if (sessionValue) {
    safeWrite(window.localStorage, key, sessionValue)
  }

  return sessionValue
}

export function writeAuthStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  safeWrite(window.localStorage, key, value)
  safeWrite(window.sessionStorage, key, value)
}

export function removeAuthStorage(key: string) {
  if (typeof window === 'undefined') return
  safeRemove(window.localStorage, key)
  safeRemove(window.sessionStorage, key)
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions extends RequestInit {
  /** JSON-serializable body. Sets Content-Type automatically. Takes precedence over `body`. */
  json?: unknown
  /** If true, skip attaching the Authorization header even if a token exists. */
  skipAuth?: boolean
}

/**
 * Core fetch wrapper. Resolves relative paths against API_URL.
 * Throws ApiError for non-2xx responses.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, skipAuth, ...rest } = options

  const headers = new Headers(rest.headers)

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (!skipAuth) {
    const token = readAuthStorage(ACCESS_TOKEN_KEY)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`

  const resolvedBody: BodyInit | null | undefined =
    json !== undefined ? JSON.stringify(json) : rest.body

  const fetchInit: RequestInit = { ...rest, headers }
  if (resolvedBody !== undefined) {
    fetchInit.body = resolvedBody
  }

  const res = await fetch(url, fetchInit)

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { message?: string; error?: string }
      message = body.message ?? body.error ?? message
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message)
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export type PRMergeMethod = 'merge' | 'squash' | 'rebase'

export interface MergePullRequestInput {
  repoId: string
  pullNumber: number
  headSha: string
  installationId: number
  mergeMethod?: PRMergeMethod
}

export interface MergePullRequestResponse {
  pullRequestId: string
  jobId: string
  status: 'queued'
}

export interface PullRequestStatusResponse {
  pullRequestId: string
  prNumber: number
  mergeStatus: string
  mergeMethod: string
  headSha: string
  mergedAt: string | null
  lastError: string | null
  jobId: string | null
}

export interface GitHubInstallUrlResponse {
  installUrl: string
  state: string
}

export interface GitHubInstallationSyncResponse {
  synced: boolean
  repositories: number
  pullRequests: number
}

export function mergePullRequest(input: MergePullRequestInput) {
  return apiRequest<MergePullRequestResponse>('/pull-requests/merge', {
    method: 'POST',
    json: input,
  })
}

export function getPullRequestStatus(repoId: string, prNumber: number) {
  return apiRequest<PullRequestStatusResponse>(
    `/pull-requests/${encodeURIComponent(repoId)}/${encodeURIComponent(String(prNumber))}/status`,
  )
}

export function getGitHubInstallUrl(input: {
  orgId?: string | null
  projectId?: string | null
  returnTo?: string | null
}) {
  const params = new URLSearchParams()
  if (input.orgId) params.set('orgId', input.orgId)
  if (input.projectId) params.set('projectId', input.projectId)
  if (input.returnTo) params.set('returnTo', input.returnTo)
  const query = params.toString()
  return apiRequest<GitHubInstallUrlResponse>(
    `/github/install-url${query ? `?${query}` : ''}`,
  )
}

export function syncGitHubInstallation(installationId: string | number) {
  return apiRequest<GitHubInstallationSyncResponse>(
    `/github/installations/${encodeURIComponent(String(installationId))}/sync`,
    { method: 'POST' },
  )
}
