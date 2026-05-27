/**
 * Demo data fixtures for DeployTitan console.
 *
 * Used when no real Zero data exists (empty org/project state).
 * Covers all three core products: Titan Rollout, Titan Foresight, Titan Phoenix.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeployStatus = 'deploying' | 'canary' | 'completed' | 'failed' | 'rolled_back'
export type RiskLevel = 'low' | 'medium' | 'high'
export type ServiceHealth = 'healthy' | 'degraded' | 'incident'
export type EnvName = 'production' | 'staging' | 'preview'

export interface DemoDeployment {
  id: string
  version: string
  status: DeployStatus
  strategy: 'canary' | 'blue-green' | 'ring'
  /** canary weight 0–100 */
  canaryWeight: number
  /** stable weight 0–100 */
  stableWeight: number
  startedAt: number
  completedAt: number | null
  errorRate: number
  p99Latency: number
  /** SLO thresholds */
  errorRateThreshold: number
  p99Threshold: number
  /** Foresight risk for the PR that produced this version */
  prRiskScore: number
  prRiskLevel: RiskLevel
  prNumber: number
  prTitle: string
  prAuthor: string
  /** commit SHA (short) */
  commitSha: string
  /** branch name */
  branch: string
  env: EnvName
  /** Phoenix rollback event, if any */
  rollbackEvent: {
    triggeredAt: number
    scope: 'cohort' | 'region' | 'flag'
    recoveryMs: number
    triggeredBy: 'slo_breach' | 'manual'
  } | null
  /** Promotion gates that were checked */
  gates: Array<{
    name: string
    status: 'passed' | 'failed' | 'pending' | 'skipped'
    value: string
  }>
  /** Duration in seconds for completed deploys */
  durationSecs: number | null
}

export interface DemoServiceEnv {
  env: EnvName
  health: ServiceHealth
  activeVersion: string
  stableVersion: string
  errorRate: number
  p99Latency: number
  requestsPerMin: number
  replicas: number
  lastDeployedAt: number
}

export interface DemoService {
  id: string
  serviceName: string
  /** Display label */
  displayName: string
  /** Short description */
  description: string
  /** Repo URL */
  repoUrl: string
  /** Runtime (e.g. Node.js 22, Go 1.22, Python 3.12) */
  runtime: string
  /** Team that owns this service */
  team: string
  health: ServiceHealth
  routingStrategy: 'canary' | 'blue-green' | 'ring'
  activeVersion: string
  stableVersion: string
  lastDeployedAt: number
  deployments: DemoDeployment[]
  /** SLO gates */
  errorRate: number
  p99Latency: number
  requestsPerMin: number
  /** Per-environment snapshots */
  envs: DemoServiceEnv[]
  /** Env vars / config (names only, values redacted) */
  configKeys: string[]
  /** Integration status */
  integrated: boolean
}

export interface DemoPRRisk {
  id: string
  prNumber: number
  prTitle: string
  prAuthor: string
  service: string
  riskScore: number
  riskLevel: RiskLevel
  blastRadiusCount: number
  affectedServices: string[]
  primaryOwner: string
  secondaryOwner: string | null
  recommendedPolicy: string
  analyzedAt: number
  status: 'pending_deploy' | 'deployed' | 'blocked'
  /** Key risk factors surfaced by Foresight */
  riskFactors: string[]
}

export interface DemoIncident {
  id: string
  service: string
  version: string
  triggeredAt: number
  resolvedAt: number | null
  scope: 'cohort' | 'region' | 'flag'
  recoveryMs: number | null
  errorRateAtTrigger: number
  affectedRequests: number
  status: 'resolved' | 'active'
}

/** Project-level activity feed event */
export interface DemoActivityEvent {
  id: string
  ts: number
  type: 'deploy' | 'rollback' | 'incident' | 'pr_analyzed' | 'config_change' | 'member_joined' | 'integration_added'
  service: string | null
  title: string
  detail: string
  actor: string
  severity: 'info' | 'warn' | 'error'
  link?: string
}

/** IaC diff block for the integration configurator */
export interface DemoIaCDiff {
  filename: string
  hunks: Array<{
    header: string
    lines: Array<{ kind: 'ctx' | 'add' | 'del'; content: string }>
  }>
}

// ─── Now ──────────────────────────────────────────────────────────────────────

const NOW = Date.now()
const mins = (n: number) => n * 60 * 1000
const hours = (n: number) => n * 60 * mins(1)
const days = (n: number) => n * 24 * hours(1)

// ─── Demo Services ────────────────────────────────────────────────────────────

export const DEMO_SERVICES: DemoService[] = [
  {
    id: 'svc-api-gateway',
    serviceName: 'api-gateway',
    displayName: 'API Gateway',
    description: 'Edge router — auth, rate-limiting, upstream proxying.',
    repoUrl: 'https://github.com/acme/api-gateway',
    runtime: 'Node.js 22 LTS',
    team: 'platform-team',
    health: 'healthy',
    routingStrategy: 'canary',
    activeVersion: 'v2.4.2',
    stableVersion: 'v2.4.1',
    lastDeployedAt: NOW - mins(23),
    errorRate: 0.02,
    p99Latency: 118,
    requestsPerMin: 4820,
    integrated: true,
    configKeys: ['PORT', 'REDIS_URL', 'JWT_SECRET', 'RATE_LIMIT_BURST', 'UPSTREAM_TIMEOUT_MS', 'DD_API_KEY'],
    envs: [
      { env: 'production', health: 'healthy',  activeVersion: 'v2.4.2', stableVersion: 'v2.4.1', errorRate: 0.02, p99Latency: 118, requestsPerMin: 4820, replicas: 6, lastDeployedAt: NOW - mins(23) },
      { env: 'staging',    health: 'healthy',  activeVersion: 'v2.4.3-rc', stableVersion: 'v2.4.2', errorRate: 0.10, p99Latency: 131, requestsPerMin: 320, replicas: 2, lastDeployedAt: NOW - hours(2) },
      { env: 'preview',    health: 'healthy',  activeVersion: 'v2.4.3-rc', stableVersion: 'v2.4.2', errorRate: 0.00, p99Latency: 145, requestsPerMin: 12, replicas: 1, lastDeployedAt: NOW - hours(2) },
    ],
    deployments: [
      {
        id: 'dep-agw-01',
        version: 'v2.4.2',
        status: 'canary',
        strategy: 'canary',
        canaryWeight: 25,
        stableWeight: 75,
        startedAt: NOW - mins(23),
        completedAt: null,
        errorRate: 0.02,
        p99Latency: 118,
        errorRateThreshold: 0.5,
        p99Threshold: 250,
        prRiskScore: 28,
        prRiskLevel: 'low',
        prNumber: 2847,
        prTitle: 'feat: add request tracing headers to upstream calls',
        prAuthor: 'alice',
        commitSha: 'a3f8c12',
        branch: 'feat/tracing-headers',
        env: 'production',
        rollbackEvent: null,
        durationSecs: null,
        gates: [
          { name: 'Error rate < 0.5%',  status: 'passed',  value: '0.02%' },
          { name: 'p99 < 250ms',        status: 'passed',  value: '118ms' },
          { name: 'Smoke tests',        status: 'passed',  value: 'All green' },
          { name: 'Manual approval',    status: 'pending', value: 'Waiting' },
        ],
      },
      {
        id: 'dep-agw-02',
        version: 'v2.4.1',
        status: 'completed',
        strategy: 'canary',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(2) - hours(3),
        completedAt: NOW - days(2),
        errorRate: 0.01,
        p99Latency: 112,
        errorRateThreshold: 0.5,
        p99Threshold: 250,
        prRiskScore: 12,
        prRiskLevel: 'low',
        prNumber: 2831,
        prTitle: 'fix: normalize auth header casing for downstream services',
        prAuthor: 'bob',
        commitSha: 'c91e4a7',
        branch: 'fix/auth-header-casing',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 1920,
        gates: [
          { name: 'Error rate < 0.5%', status: 'passed', value: '0.01%' },
          { name: 'p99 < 250ms',       status: 'passed', value: '112ms' },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
          { name: 'Manual approval',   status: 'skipped', value: 'Auto-promoted' },
        ],
      },
      {
        id: 'dep-agw-03',
        version: 'v2.4.0',
        status: 'rolled_back',
        strategy: 'canary',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(5) - hours(1),
        completedAt: NOW - days(5),
        errorRate: 2.4,
        p99Latency: 380,
        errorRateThreshold: 0.5,
        p99Threshold: 250,
        prRiskScore: 71,
        prRiskLevel: 'high',
        prNumber: 2809,
        prTitle: 'refactor: migrate rate-limiter to Redis cluster',
        prAuthor: 'carol',
        commitSha: 'f44b9e1',
        branch: 'refactor/redis-rate-limiter',
        env: 'production',
        rollbackEvent: {
          triggeredAt: NOW - days(5) - mins(48),
          scope: 'cohort',
          recoveryMs: 8200,
          triggeredBy: 'slo_breach',
        },
        durationSecs: 780,
        gates: [
          { name: 'Error rate < 0.5%', status: 'failed', value: '2.4%' },
          { name: 'p99 < 250ms',       status: 'failed', value: '380ms' },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
          { name: 'Manual approval',   status: 'skipped', value: 'Auto-promoted' },
        ],
      },
    ],
  },
  {
    id: 'svc-payment',
    serviceName: 'payment-service',
    displayName: 'Payment Service',
    description: 'Stripe integration — charge, refund, subscription lifecycle.',
    repoUrl: 'https://github.com/acme/payment-service',
    runtime: 'Node.js 22 LTS',
    team: 'payments-team',
    health: 'healthy',
    routingStrategy: 'canary',
    activeVersion: 'v1.9.4',
    stableVersion: 'v1.9.4',
    lastDeployedAt: NOW - hours(14),
    errorRate: 0.00,
    p99Latency: 94,
    requestsPerMin: 1240,
    integrated: true,
    configKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'DB_URL', 'REDIS_URL', 'PORT', 'LOG_LEVEL'],
    envs: [
      { env: 'production', health: 'healthy', activeVersion: 'v1.9.4', stableVersion: 'v1.9.4', errorRate: 0.00, p99Latency: 94,  requestsPerMin: 1240, replicas: 4, lastDeployedAt: NOW - hours(14) },
      { env: 'staging',    health: 'healthy', activeVersion: 'v1.9.5-rc', stableVersion: 'v1.9.4', errorRate: 0.04, p99Latency: 101, requestsPerMin: 88, replicas: 2, lastDeployedAt: NOW - hours(5) },
      { env: 'preview',    health: 'healthy', activeVersion: 'v1.9.5-rc', stableVersion: 'v1.9.4', errorRate: 0.00, p99Latency: 110, requestsPerMin: 4, replicas: 1, lastDeployedAt: NOW - hours(5) },
    ],
    deployments: [
      {
        id: 'dep-pay-01',
        version: 'v1.9.4',
        status: 'completed',
        strategy: 'canary',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - hours(16),
        completedAt: NOW - hours(14),
        errorRate: 0.00,
        p99Latency: 94,
        errorRateThreshold: 0.2,
        p99Threshold: 200,
        prRiskScore: 18,
        prRiskLevel: 'low',
        prNumber: 891,
        prTitle: 'fix: idempotency key TTL off-by-one on retry window',
        prAuthor: 'dan',
        commitSha: 'b22d0f3',
        branch: 'fix/idempotency-ttl',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 7200,
        gates: [
          { name: 'Error rate < 0.2%', status: 'passed', value: '0.00%' },
          { name: 'p99 < 200ms',       status: 'passed', value: '94ms'  },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
        ],
      },
      {
        id: 'dep-pay-02',
        version: 'v1.9.3',
        status: 'completed',
        strategy: 'canary',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(3) - hours(2),
        completedAt: NOW - days(3),
        errorRate: 0.01,
        p99Latency: 96,
        errorRateThreshold: 0.2,
        p99Threshold: 200,
        prRiskScore: 9,
        prRiskLevel: 'low',
        prNumber: 882,
        prTitle: 'chore: upgrade stripe-node to v14',
        prAuthor: 'alice',
        commitSha: 'e77f1a9',
        branch: 'chore/stripe-v14',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 10800,
        gates: [
          { name: 'Error rate < 0.2%', status: 'passed', value: '0.01%' },
          { name: 'p99 < 200ms',       status: 'passed', value: '96ms'  },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
        ],
      },
    ],
  },
  {
    id: 'svc-auth',
    serviceName: 'auth-service',
    displayName: 'Auth Service',
    description: 'OAuth 2.0 / OIDC provider — tokens, sessions, PKCE.',
    repoUrl: 'https://github.com/acme/auth-service',
    runtime: 'Go 1.22',
    team: 'security-team',
    health: 'degraded',
    routingStrategy: 'canary',
    activeVersion: 'v3.1.1',
    stableVersion: 'v3.1.0',
    lastDeployedAt: NOW - mins(7),
    errorRate: 0.38,
    p99Latency: 198,
    requestsPerMin: 2100,
    integrated: true,
    configKeys: ['OIDC_ISSUER', 'JWT_PRIVATE_KEY', 'DB_URL', 'REDIS_URL', 'PORT', 'SESSION_MAX_AGE_S'],
    envs: [
      { env: 'production', health: 'degraded', activeVersion: 'v3.1.1', stableVersion: 'v3.1.0', errorRate: 0.38, p99Latency: 198, requestsPerMin: 2100, replicas: 4, lastDeployedAt: NOW - mins(7) },
      { env: 'staging',    health: 'healthy',  activeVersion: 'v3.1.1', stableVersion: 'v3.1.0', errorRate: 0.05, p99Latency: 160, requestsPerMin: 140,  replicas: 2, lastDeployedAt: NOW - hours(1) },
      { env: 'preview',    health: 'healthy',  activeVersion: 'v3.1.1', stableVersion: 'v3.1.0', errorRate: 0.00, p99Latency: 170, requestsPerMin: 5,    replicas: 1, lastDeployedAt: NOW - hours(1) },
    ],
    deployments: [
      {
        id: 'dep-auth-01',
        version: 'v3.1.1',
        status: 'canary',
        strategy: 'canary',
        canaryWeight: 10,
        stableWeight: 90,
        startedAt: NOW - mins(7),
        completedAt: null,
        errorRate: 0.38,
        p99Latency: 198,
        errorRateThreshold: 0.5,
        p99Threshold: 200,
        prRiskScore: 54,
        prRiskLevel: 'medium',
        prNumber: 1204,
        prTitle: 'feat: add PKCE flow for public clients',
        prAuthor: 'eve',
        commitSha: 'd09c2b4',
        branch: 'feat/pkce-public-clients',
        env: 'production',
        rollbackEvent: null,
        durationSecs: null,
        gates: [
          { name: 'Error rate < 0.5%', status: 'passed',  value: '0.38%' },
          { name: 'p99 < 200ms',       status: 'pending', value: '198ms' },
          { name: 'Smoke tests',       status: 'passed',  value: 'All green' },
        ],
      },
      {
        id: 'dep-auth-02',
        version: 'v3.1.0',
        status: 'completed',
        strategy: 'canary',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(1) - hours(4),
        completedAt: NOW - days(1),
        errorRate: 0.02,
        p99Latency: 142,
        errorRateThreshold: 0.5,
        p99Threshold: 200,
        prRiskScore: 22,
        prRiskLevel: 'low',
        prNumber: 1198,
        prTitle: 'fix: session token rotation on password change',
        prAuthor: 'alice',
        commitSha: '7a4f8d6',
        branch: 'fix/session-rotation',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 14400,
        gates: [
          { name: 'Error rate < 0.5%', status: 'passed', value: '0.02%' },
          { name: 'p99 < 200ms',       status: 'passed', value: '142ms' },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
        ],
      },
    ],
  },
  {
    id: 'svc-worker',
    serviceName: 'job-worker',
    displayName: 'Job Worker',
    description: 'Background job processor — image resize, email queue, cron.',
    repoUrl: 'https://github.com/acme/job-worker',
    runtime: 'Node.js 22 LTS',
    team: 'platform-team',
    health: 'healthy',
    routingStrategy: 'ring',
    activeVersion: 'v4.2.0',
    stableVersion: 'v4.2.0',
    lastDeployedAt: NOW - days(1) - hours(2),
    errorRate: 0.00,
    p99Latency: 44,
    requestsPerMin: 380,
    integrated: true,
    configKeys: ['REDIS_URL', 'DB_URL', 'S3_BUCKET', 'S3_REGION', 'LOG_LEVEL', 'MAX_CONCURRENCY'],
    envs: [
      { env: 'production', health: 'healthy', activeVersion: 'v4.2.0', stableVersion: 'v4.2.0', errorRate: 0.00, p99Latency: 44,  requestsPerMin: 380, replicas: 3, lastDeployedAt: NOW - days(1) - hours(2) },
      { env: 'staging',    health: 'healthy', activeVersion: 'v4.2.1-rc', stableVersion: 'v4.2.0', errorRate: 0.00, p99Latency: 48,  requestsPerMin: 24,  replicas: 1, lastDeployedAt: NOW - hours(3) },
      { env: 'preview',    health: 'healthy', activeVersion: 'v4.2.1-rc', stableVersion: 'v4.2.0', errorRate: 0.00, p99Latency: 52,  requestsPerMin: 2,   replicas: 1, lastDeployedAt: NOW - hours(3) },
    ],
    deployments: [
      {
        id: 'dep-wrk-01',
        version: 'v4.2.0',
        status: 'completed',
        strategy: 'ring',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(1) - hours(4),
        completedAt: NOW - days(1) - hours(2),
        errorRate: 0.00,
        p99Latency: 44,
        errorRateThreshold: 1.0,
        p99Threshold: 500,
        prRiskScore: 31,
        prRiskLevel: 'low',
        prNumber: 612,
        prTitle: 'perf: batch DB writes in image-resize job',
        prAuthor: 'bob',
        commitSha: '3c71e22',
        branch: 'perf/batch-db-writes',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 7200,
        gates: [
          { name: 'Error rate < 1.0%', status: 'passed', value: '0.00%' },
          { name: 'p99 < 500ms',       status: 'passed', value: '44ms'  },
          { name: 'Ring health check', status: 'passed', value: 'All rings healthy' },
        ],
      },
    ],
  },
  {
    id: 'svc-notifications',
    serviceName: 'notification-service',
    displayName: 'Notification Service',
    description: 'Transactional email + push — provider routing, template engine.',
    repoUrl: 'https://github.com/acme/notification-service',
    runtime: 'Python 3.12',
    team: 'infra-team',
    health: 'incident',
    routingStrategy: 'blue-green',
    activeVersion: 'v2.0.1',
    stableVersion: 'v2.0.0',
    lastDeployedAt: NOW - mins(41),
    errorRate: 3.2,
    p99Latency: 1840,
    requestsPerMin: 560,
    integrated: true,
    configKeys: ['RESEND_API_KEY', 'SENDGRID_API_KEY', 'DB_URL', 'QUEUE_URL', 'PORT', 'TEMPLATE_BUCKET'],
    envs: [
      { env: 'production', health: 'incident', activeVersion: 'v2.0.1', stableVersion: 'v2.0.0', errorRate: 3.20, p99Latency: 1840, requestsPerMin: 560, replicas: 3, lastDeployedAt: NOW - mins(41) },
      { env: 'staging',    health: 'healthy',  activeVersion: 'v2.0.1', stableVersion: 'v2.0.0', errorRate: 0.12, p99Latency: 230,  requestsPerMin: 38,  replicas: 1, lastDeployedAt: NOW - hours(2) },
      { env: 'preview',    health: 'healthy',  activeVersion: 'v2.0.1', stableVersion: 'v2.0.0', errorRate: 0.00, p99Latency: 250,  requestsPerMin: 3,   replicas: 1, lastDeployedAt: NOW - hours(2) },
    ],
    deployments: [
      {
        id: 'dep-ntf-01',
        version: 'v2.0.1',
        status: 'failed',
        strategy: 'blue-green',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - mins(41),
        completedAt: NOW - mins(38),
        errorRate: 3.2,
        p99Latency: 1840,
        errorRateThreshold: 0.5,
        p99Threshold: 400,
        prRiskScore: 82,
        prRiskLevel: 'high',
        prNumber: 447,
        prTitle: 'feat: migrate email provider from SendGrid to Resend',
        prAuthor: 'carol',
        commitSha: '9b3f44c',
        branch: 'feat/resend-migration',
        env: 'production',
        rollbackEvent: {
          triggeredAt: NOW - mins(38),
          scope: 'cohort',
          recoveryMs: 6400,
          triggeredBy: 'slo_breach',
        },
        durationSecs: 180,
        gates: [
          { name: 'Error rate < 0.5%', status: 'failed', value: '3.2%'  },
          { name: 'p99 < 400ms',       status: 'failed', value: '1840ms' },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
        ],
      },
      {
        id: 'dep-ntf-02',
        version: 'v2.0.0',
        status: 'completed',
        strategy: 'blue-green',
        canaryWeight: 0,
        stableWeight: 100,
        startedAt: NOW - days(4),
        completedAt: NOW - days(4) + mins(8),
        errorRate: 0.04,
        p99Latency: 210,
        errorRateThreshold: 0.5,
        p99Threshold: 400,
        prRiskScore: 24,
        prRiskLevel: 'low',
        prNumber: 441,
        prTitle: 'refactor: extract notification template engine',
        prAuthor: 'dan',
        commitSha: '4a8e113',
        branch: 'refactor/template-engine',
        env: 'production',
        rollbackEvent: null,
        durationSecs: 480,
        gates: [
          { name: 'Error rate < 0.5%', status: 'passed', value: '0.04%' },
          { name: 'p99 < 400ms',       status: 'passed', value: '210ms' },
          { name: 'Smoke tests',       status: 'passed', value: 'All green' },
        ],
      },
    ],
  },
  // Sixth service — not yet integrated, for integration flow demo
  {
    id: 'svc-search',
    serviceName: 'search-service',
    displayName: 'Search Service',
    description: 'Full-text and vector search powered by Elasticsearch.',
    repoUrl: 'https://github.com/acme/search-service',
    runtime: 'Java 21 (Spring Boot)',
    team: 'platform-team',
    health: 'healthy',
    routingStrategy: 'canary',
    activeVersion: 'v1.4.2',
    stableVersion: 'v1.4.2',
    lastDeployedAt: NOW - days(6),
    errorRate: 0.00,
    p99Latency: 72,
    requestsPerMin: 920,
    integrated: false,
    configKeys: [],
    envs: [
      { env: 'production', health: 'healthy', activeVersion: 'v1.4.2', stableVersion: 'v1.4.2', errorRate: 0.00, p99Latency: 72, requestsPerMin: 920, replicas: 2, lastDeployedAt: NOW - days(6) },
    ],
    deployments: [],
  },
]

// ─── Demo PR Risk Queue ────────────────────────────────────────────────────────

export const DEMO_PR_RISKS: DemoPRRisk[] = [
  {
    id: 'pr-risk-01',
    prNumber: 1207,
    prTitle: 'feat: add OAuth 2.0 device flow to auth-service',
    prAuthor: 'eve',
    service: 'auth-service',
    riskScore: 76,
    riskLevel: 'high',
    blastRadiusCount: 5,
    affectedServices: ['api-gateway', 'auth-service', 'payment-service', 'notification-service', 'job-worker'],
    primaryOwner: 'platform-team',
    secondaryOwner: 'security-team',
    recommendedPolicy: '5% initial cohort, 10m promotion window, mandatory SLO gates',
    analyzedAt: NOW - mins(14),
    status: 'pending_deploy',
    riskFactors: [
      'Touches auth token signing logic (high blast radius)',
      '5 downstream services depend on token format',
      'No integration tests for device flow',
      'Large diff (+842 / -201 lines)',
    ],
  },
  {
    id: 'pr-risk-02',
    prNumber: 2851,
    prTitle: 'feat: rate-limit by user tier on api-gateway',
    prAuthor: 'alice',
    service: 'api-gateway',
    riskScore: 54,
    riskLevel: 'medium',
    blastRadiusCount: 3,
    affectedServices: ['api-gateway', 'auth-service', 'payment-service'],
    primaryOwner: 'platform-team',
    secondaryOwner: 'payments-team',
    recommendedPolicy: '10% initial cohort, 5m promotion window',
    analyzedAt: NOW - mins(31),
    status: 'pending_deploy',
    riskFactors: [
      'Modifies request routing hot-path',
      'Auth-service dependency for tier lookup adds latency risk',
      'New Redis key schema — migration required',
    ],
  },
  {
    id: 'pr-risk-03',
    prNumber: 892,
    prTitle: 'fix: handle 3DS2 challenge redirect on mobile',
    prAuthor: 'dan',
    service: 'payment-service',
    riskScore: 22,
    riskLevel: 'low',
    blastRadiusCount: 1,
    affectedServices: ['payment-service'],
    primaryOwner: 'payments-team',
    secondaryOwner: null,
    recommendedPolicy: '25% initial cohort, standard gates',
    analyzedAt: NOW - hours(1) - mins(12),
    status: 'deployed',
    riskFactors: [
      'Isolated to payment-service mobile redirect path',
      'Well-tested — 18 new test cases',
    ],
  },
  {
    id: 'pr-risk-04',
    prNumber: 447,
    prTitle: 'feat: migrate email provider from SendGrid to Resend',
    prAuthor: 'carol',
    service: 'notification-service',
    riskScore: 82,
    riskLevel: 'high',
    blastRadiusCount: 4,
    affectedServices: ['notification-service', 'auth-service', 'payment-service', 'job-worker'],
    primaryOwner: 'infra-team',
    secondaryOwner: 'platform-team',
    recommendedPolicy: '5% initial cohort, manual promotion approval required',
    analyzedAt: NOW - hours(2),
    status: 'deployed',
    riskFactors: [
      'External provider swap — no local fallback',
      '4 services send transactional email via notification-service',
      'Provider SLA difference (99.9% → 99.5%)',
      'No staging traffic validation performed',
    ],
  },
  {
    id: 'pr-risk-05',
    prNumber: 613,
    prTitle: 'chore: upgrade Node.js runtime to v22 LTS in job-worker',
    prAuthor: 'bob',
    service: 'job-worker',
    riskScore: 38,
    riskLevel: 'low',
    blastRadiusCount: 1,
    affectedServices: ['job-worker'],
    primaryOwner: 'platform-team',
    secondaryOwner: null,
    recommendedPolicy: 'ring strategy, 2-ring promotion',
    analyzedAt: NOW - hours(3),
    status: 'pending_deploy',
    riskFactors: [
      'Runtime upgrade — potential native module incompatibilities',
      'Only affects job-worker (isolated)',
    ],
  },
]

// ─── Demo Incidents ────────────────────────────────────────────────────────────

export const DEMO_INCIDENTS: DemoIncident[] = [
  {
    id: 'inc-01',
    service: 'notification-service',
    version: 'v2.0.1',
    triggeredAt: NOW - mins(38),
    resolvedAt: NOW - mins(31),
    scope: 'cohort',
    recoveryMs: 6400,
    errorRateAtTrigger: 3.2,
    affectedRequests: 1840,
    status: 'resolved',
  },
  {
    id: 'inc-02',
    service: 'api-gateway',
    version: 'v2.4.0',
    triggeredAt: NOW - days(5) - mins(48),
    resolvedAt: NOW - days(5) - mins(46),
    scope: 'cohort',
    recoveryMs: 8200,
    errorRateAtTrigger: 2.4,
    affectedRequests: 3100,
    status: 'resolved',
  },
]

// ─── Demo Activity Feed ───────────────────────────────────────────────────────

export const DEMO_ACTIVITY: DemoActivityEvent[] = [
  { id: 'act-01', ts: NOW - mins(23),  type: 'deploy',            service: 'api-gateway',          title: 'Canary started',          detail: 'v2.4.2 → 25% traffic (PR #2847)',            actor: 'alice',    severity: 'info'  },
  { id: 'act-02', ts: NOW - mins(38),  type: 'rollback',          service: 'notification-service', title: 'Phoenix rollback',         detail: 'v2.0.1 rolled back — SLO breach (3.2% err)', actor: 'system',   severity: 'error' },
  { id: 'act-03', ts: NOW - mins(41),  type: 'deploy',            service: 'notification-service', title: 'Deployment failed',        detail: 'v2.0.1 deploy failed — high error rate',     actor: 'carol',    severity: 'error' },
  { id: 'act-04', ts: NOW - hours(2),  type: 'pr_analyzed',       service: 'api-gateway',          title: 'Foresight: medium risk',   detail: 'PR #2851 — rate-limit by user tier',         actor: 'foresight', severity: 'warn'  },
  { id: 'act-05', ts: NOW - hours(14), type: 'deploy',            service: 'payment-service',      title: 'Deployment promoted',      detail: 'v1.9.4 promoted to 100% traffic',            actor: 'system',   severity: 'info'  },
  { id: 'act-06', ts: NOW - hours(16), type: 'deploy',            service: 'payment-service',      title: 'Canary started',          detail: 'v1.9.4 → 10% traffic (PR #891)',             actor: 'dan',      severity: 'info'  },
  { id: 'act-07', ts: NOW - days(1),   type: 'deploy',            service: 'auth-service',         title: 'Deployment completed',     detail: 'v3.1.0 fully promoted',                      actor: 'system',   severity: 'info'  },
  { id: 'act-08', ts: NOW - days(1) - hours(2), type: 'deploy',   service: 'job-worker',           title: 'Ring deploy completed',    detail: 'v4.2.0 all rings healthy',                   actor: 'bob',      severity: 'info'  },
  { id: 'act-09', ts: NOW - days(2),   type: 'deploy',            service: 'api-gateway',          title: 'Deployment completed',     detail: 'v2.4.1 fully promoted',                      actor: 'system',   severity: 'info'  },
  { id: 'act-10', ts: NOW - days(3),   type: 'config_change',     service: 'payment-service',      title: 'Config updated',           detail: 'STRIPE_WEBHOOK_SECRET rotated',              actor: 'alice',    severity: 'warn'  },
  { id: 'act-11', ts: NOW - days(4),   type: 'deploy',            service: 'notification-service', title: 'Deployment completed',     detail: 'v2.0.0 fully promoted',                      actor: 'system',   severity: 'info'  },
  { id: 'act-12', ts: NOW - days(5),   type: 'rollback',          service: 'api-gateway',          title: 'Phoenix rollback',         detail: 'v2.4.0 rolled back — SLO breach (2.4% err)', actor: 'system',   severity: 'error' },
  { id: 'act-13', ts: NOW - days(6),   type: 'member_joined',     service: null,                   title: 'Member joined',            detail: 'eve@acme.com joined the project',            actor: 'alice',    severity: 'info'  },
  { id: 'act-14', ts: NOW - days(7),   type: 'integration_added', service: 'job-worker',           title: 'Integration added',        detail: 'DeployTitan integrated via PR #609',          actor: 'bob',      severity: 'info'  },
]

// ─── Timeline-enriched activity feed ─────────────────────────────────────────
// Denser fixture set that provides meaningful cross-service correlation data
// for the Timeline page (7-day window with incident cascade visible in 24h).

export const DEMO_TIMELINE_EVENTS: DemoActivityEvent[] = [
  // ── T-0: current incident cascade ──────────────────────────────────────────
  { id: 'tl-01', ts: NOW - mins(23),  type: 'deploy',        service: 'api-gateway',          title: 'Canary started',           detail: 'v2.4.2 → 25% traffic (PR #2847). Rate-limit refactor.', actor: 'alice',     severity: 'info'  },
  { id: 'tl-02', ts: NOW - mins(31),  type: 'pr_analyzed',   service: 'api-gateway',          title: 'Foresight: medium risk',   detail: 'PR #2847 — blast radius: 3 downstream services',        actor: 'foresight', severity: 'warn'  },
  { id: 'tl-03', ts: NOW - mins(38),  type: 'incident',      service: 'notification-service', title: 'SLO breach detected',      detail: 'Error rate 3.2% (threshold 1%). Canary traffic spike.',  actor: 'system',    severity: 'error' },
  { id: 'tl-04', ts: NOW - mins(40),  type: 'deploy',        service: 'notification-service', title: 'Deployment failed',        detail: 'v2.0.1 deploy failed — error rate exceeded threshold',   actor: 'carol',     severity: 'error' },
  { id: 'tl-05', ts: NOW - mins(41),  type: 'rollback',      service: 'notification-service', title: 'Phoenix rollback',         detail: 'v2.0.1 → v2.0.0. SLO breach. Recovery: 6.2s',           actor: 'system',    severity: 'error' },
  { id: 'tl-06', ts: NOW - mins(55),  type: 'deploy',        service: 'notification-service', title: 'Canary started',           detail: 'v2.0.1 → 10% traffic (PR #1042). Push notification auth.',actor: 'carol',    severity: 'info'  },

  // ── T-2h: api-gateway Foresight warning, payment deploy ────────────────────
  { id: 'tl-07', ts: NOW - hours(2),  type: 'pr_analyzed',   service: 'api-gateway',          title: 'Foresight: medium risk',   detail: 'PR #2851 — rate-limit by user tier. 2 affected services.', actor: 'foresight', severity: 'warn' },
  { id: 'tl-08', ts: NOW - hours(2) - mins(15), type: 'config_change', service: 'api-gateway', title: 'Config updated',          detail: 'RATE_LIMIT_BURST increased from 500 → 1000',              actor: 'alice',    severity: 'warn'  },

  // ── T-14h: payment-service successful canary ────────────────────────────────
  { id: 'tl-09', ts: NOW - hours(14), type: 'deploy',        service: 'payment-service',      title: 'Deployment promoted',      detail: 'v1.9.4 promoted to 100% — all gates passed',             actor: 'system',    severity: 'info'  },
  { id: 'tl-10', ts: NOW - hours(16), type: 'deploy',        service: 'payment-service',      title: 'Canary started',           detail: 'v1.9.4 → 10% traffic (PR #891). Stripe webhook update.',  actor: 'dan',      severity: 'info'  },
  { id: 'tl-11', ts: NOW - hours(16) - mins(20), type: 'pr_analyzed', service: 'payment-service', title: 'Foresight: low risk',  detail: 'PR #891 — minor webhook signature change. Score: 12',     actor: 'foresight', severity: 'info' },

  // ── T-20h: search-service deploy ───────────────────────────────────────────
  { id: 'tl-12', ts: NOW - hours(20), type: 'deploy',        service: 'search-service',       title: 'Blue-green cutover',       detail: 'v1.3.2 fully promoted via blue-green swap',              actor: 'system',    severity: 'info'  },
  { id: 'tl-13', ts: NOW - hours(22), type: 'deploy',        service: 'search-service',       title: 'Blue-green started',       detail: 'v1.3.2 — index schema migration (PR #411)',              actor: 'eve',       severity: 'info'  },

  // ── T-1d: auth-service + job-worker deploys ─────────────────────────────────
  { id: 'tl-14', ts: NOW - days(1),            type: 'deploy',      service: 'auth-service',    title: 'Deployment completed',    detail: 'v3.1.0 fully promoted. OAuth2 PKCE support.',            actor: 'system',    severity: 'info'  },
  { id: 'tl-15', ts: NOW - days(1) - hours(1), type: 'deploy',      service: 'auth-service',    title: 'Canary started',          detail: 'v3.1.0 → 20% traffic (PR #776)',                        actor: 'frank',     severity: 'info'  },
  { id: 'tl-16', ts: NOW - days(1) - hours(2), type: 'deploy',      service: 'job-worker',      title: 'Ring deploy completed',   detail: 'v4.2.0 all rings healthy. Async retry queue.',           actor: 'bob',       severity: 'info'  },
  { id: 'tl-17', ts: NOW - days(1) - hours(3), type: 'deploy',      service: 'job-worker',      title: 'Ring deploy: ring-1',     detail: 'v4.2.0 ring-1 (us-east-1) deployed — healthy',          actor: 'bob',       severity: 'info'  },
  { id: 'tl-18', ts: NOW - days(1) - hours(5), type: 'pr_analyzed', service: 'auth-service',    title: 'Foresight: high risk',    detail: 'PR #776 — auth token scope change. Score: 87. Review.',  actor: 'foresight', severity: 'warn'  },

  // ── T-2d: api-gateway successful deploy ────────────────────────────────────
  { id: 'tl-19', ts: NOW - days(2),   type: 'deploy',        service: 'api-gateway',          title: 'Deployment completed',     detail: 'v2.4.1 fully promoted',                                  actor: 'system',    severity: 'info'  },
  { id: 'tl-20', ts: NOW - days(2) - hours(3), type: 'deploy', service: 'api-gateway',        title: 'Canary started',           detail: 'v2.4.1 → 15% traffic (PR #2831)',                       actor: 'alice',     severity: 'info'  },

  // ── T-3d: payment-service config + notification deploy ─────────────────────
  { id: 'tl-21', ts: NOW - days(3),            type: 'config_change', service: 'payment-service', title: 'Config updated',         detail: 'STRIPE_WEBHOOK_SECRET rotated (scheduled rotation)',     actor: 'alice',    severity: 'warn'  },
  { id: 'tl-22', ts: NOW - days(3) - hours(4), type: 'deploy',        service: 'search-service',  title: 'Deployment completed',   detail: 'v1.3.1 fully promoted. Query parser fix.',               actor: 'system',   severity: 'info'  },

  // ── T-4d: notification-service stable deploy ────────────────────────────────
  { id: 'tl-23', ts: NOW - days(4),   type: 'deploy',        service: 'notification-service', title: 'Deployment completed',     detail: 'v2.0.0 fully promoted. Redesigned retry logic.',         actor: 'system',    severity: 'info'  },
  { id: 'tl-24', ts: NOW - days(4) - hours(2), type: 'deploy', service: 'notification-service', title: 'Canary started',         detail: 'v2.0.0 → 10% traffic (PR #1028)',                        actor: 'carol',    severity: 'info'  },

  // ── T-5d: api-gateway incident cascade ─────────────────────────────────────
  { id: 'tl-25', ts: NOW - days(5),   type: 'rollback',      service: 'api-gateway',          title: 'Phoenix rollback',         detail: 'v2.4.0 → v2.3.9. SLO breach (2.4% err). Recovery: 8.2s', actor: 'system',  severity: 'error' },
  { id: 'tl-26', ts: NOW - days(5) - mins(10), type: 'incident', service: 'api-gateway',      title: 'SLO breach detected',      detail: 'p99 latency 890ms (threshold 500ms). Spike on /auth',    actor: 'system',   severity: 'error' },
  { id: 'tl-27', ts: NOW - days(5) - mins(48), type: 'deploy',   service: 'api-gateway',      title: 'Canary started',           detail: 'v2.4.0 → 20% traffic (PR #2801). Middleware rewrite.',   actor: 'alice',    severity: 'info'  },
  { id: 'tl-28', ts: NOW - days(5) - hours(2), type: 'config_change', service: 'job-worker',  title: 'Config updated',           detail: 'QUEUE_CONCURRENCY increased from 8 → 16',                actor: 'bob',      severity: 'info'  },

  // ── T-6d: member + search deploy ───────────────────────────────────────────
  { id: 'tl-29', ts: NOW - days(6),   type: 'member_joined', service: null,                   title: 'Member joined',            detail: 'eve@acme.com joined as Staff Engineer',                  actor: 'alice',    severity: 'info'  },
  { id: 'tl-30', ts: NOW - days(6) - hours(3), type: 'deploy', service: 'search-service',     title: 'Deployment completed',     detail: 'v1.3.0 fully promoted. Elasticsearch 8.x migration.',    actor: 'system',   severity: 'info'  },
  { id: 'tl-31', ts: NOW - days(6) - hours(6), type: 'pr_analyzed', service: 'search-service', title: 'Foresight: medium risk',  detail: 'PR #397 — Elasticsearch major version bump. Score: 64.', actor: 'foresight', severity: 'warn' },

  // ── T-7d: job-worker integration ───────────────────────────────────────────
  { id: 'tl-32', ts: NOW - days(7),   type: 'integration_added', service: 'job-worker',        title: 'Integration added',       detail: 'DeployTitan integrated via PR #609. First deploy enabled.', actor: 'bob',    severity: 'info'  },
]

// ─── Demo IaC Diff (integration configurator output) ─────────────────────────

export function buildIaCDiff(opts: {
  serviceName: string
  strategy: string
  errorRateThreshold: string
  p99Threshold: string
  initialWeight: string
  promotionWindow: string
  repo: string
  runtime: string
}): DemoIaCDiff[] {
  const { serviceName, strategy, errorRateThreshold, p99Threshold, initialWeight, promotionWindow, repo, runtime } = opts
  const slug = serviceName.toLowerCase().replace(/\s+/g, '-')

  return [
    {
      filename: `.deploytitan/${slug}.yaml`,
      hunks: [
        {
          header: '@@ -0,0 +1,42 @@',
          lines: [
            { kind: 'add', content: `# DeployTitan integration — generated by configurator` },
            { kind: 'add', content: `# Do not edit manually. Changes via deploytitan.com.` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `service: ${slug}` },
            { kind: 'add', content: `runtime: "${runtime}"` },
            { kind: 'add', content: `repo: "${repo}"` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `rollout:` },
            { kind: 'add', content: `  strategy: ${strategy}` },
            { kind: 'add', content: `  initial_weight: ${initialWeight}` },
            { kind: 'add', content: `  promotion_window: ${promotionWindow}m` },
            { kind: 'add', content: `  auto_promote: true` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `  gates:` },
            { kind: 'add', content: `    - type: error_rate` },
            { kind: 'add', content: `      threshold: ${errorRateThreshold}` },
            { kind: 'add', content: `      window: 5m` },
            { kind: 'add', content: `    - type: p99_latency` },
            { kind: 'add', content: `      threshold: ${p99Threshold}` },
            { kind: 'add', content: `      window: 5m` },
            { kind: 'add', content: `    - type: smoke_tests` },
            { kind: 'add', content: `      required: true` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `foresight:` },
            { kind: 'add', content: `  enabled: true` },
            { kind: 'add', content: `  block_on_high_risk: false` },
            { kind: 'add', content: `  notify_slack: "#deployments"` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `phoenix:` },
            { kind: 'add', content: `  enabled: true` },
            { kind: 'add', content: `  auto_rollback: true` },
            { kind: 'add', content: `  scope: cohort` },
            { kind: 'add', content: `  recovery_target: stable` },
          ],
        },
      ],
    },
    {
      filename: `.github/workflows/deploytitan.yml`,
      hunks: [
        {
          header: '@@ -0,0 +1,28 @@',
          lines: [
            { kind: 'add', content: `name: DeployTitan` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `on:` },
            { kind: 'add', content: `  push:` },
            { kind: 'add', content: `    branches: [main]` },
            { kind: 'add', content: `  pull_request:` },
            { kind: 'add', content: `    branches: [main]` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `jobs:` },
            { kind: 'add', content: `  foresight-analyze:` },
            { kind: 'add', content: `    if: github.event_name == 'pull_request'` },
            { kind: 'add', content: `    runs-on: ubuntu-latest` },
            { kind: 'add', content: `    steps:` },
            { kind: 'add', content: `      - uses: actions/checkout@v4` },
            { kind: 'add', content: `      - uses: deploytitan/foresight-action@v2` },
            { kind: 'add', content: `        with:` },
            { kind: 'add', content: `          api-key: \${{ secrets.DEPLOYTITAN_API_KEY }}` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `  deploy:` },
            { kind: 'add', content: `    if: github.event_name == 'push'` },
            { kind: 'add', content: `    runs-on: ubuntu-latest` },
            { kind: 'add', content: `    steps:` },
            { kind: 'add', content: `      - uses: actions/checkout@v4` },
            { kind: 'add', content: `      - uses: deploytitan/rollout-action@v2` },
            { kind: 'add', content: `        with:` },
            { kind: 'add', content: `          api-key: \${{ secrets.DEPLOYTITAN_API_KEY }}` },
            { kind: 'add', content: `          service: ${slug}` },
            { kind: 'add', content: `          config: .deploytitan/${slug}.yaml` },
          ],
        },
      ],
    },
    {
      filename: `README.md`,
      hunks: [
        {
          header: '@@ -1,4 +1,12 @@',
          lines: [
            { kind: 'ctx', content: `# ${serviceName}` },
            { kind: 'ctx', content: `` },
            { kind: 'add', content: `[![DeployTitan](https://img.shields.io/badge/DeployTitan-integrated-amber)](https://deploytitan.com)` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `## Deployment` },
            { kind: 'add', content: `` },
            { kind: 'add', content: `This service is managed by [DeployTitan](https://deploytitan.com).` },
            { kind: 'add', content: `Rollout config lives in [\`.deploytitan/${slug}.yaml\`](.deploytitan/${slug}.yaml).` },
            { kind: 'add', content: `` },
            { kind: 'ctx', content: `## Getting Started` },
            { kind: 'ctx', content: `` },
          ],
        },
      ],
    },
  ]
}
