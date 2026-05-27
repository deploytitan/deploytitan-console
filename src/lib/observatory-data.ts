/**
 * Observatory page — service topology data.
 *
 * Defines nodes (services) and edges (dependencies) for the dependency graph.
 * Nodes in tiers 0–3 map to a hierarchical left-to-right layout.
 * The 6 known DEMO_SERVICES are enriched with live deployment state;
 * the remaining 14 are mock-only services.
 */

import { DEMO_SERVICES, DEMO_ACTIVITY } from './demo-data'
import type { DeployStatus, ServiceHealth } from './demo-data'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeTier = 0 | 1 | 2 | 3

export type NodeKind =
  | 'gateway'   // Tier 0 — ingress / edge
  | 'service'   // Tier 1–2 — internal services
  | 'datastore' // Tier 3 — databases, caches, queues
  | 'external'  // Tier 3 — third-party APIs

export type RolloutConditionType =
  | 'error_rate'    // trigger/block on error rate threshold
  | 'p99_latency'   // trigger/block on latency threshold
  | 'request_count' // require minimum request sample
  | 'manual'        // human approval gate
  | 'time_window'   // only during time range (e.g. business hours)
  | 'header_match'  // route matching on request header (e.g. X-Beta: true)

export interface RolloutCondition {
  type: RolloutConditionType
  /** Human-readable description */
  label: string
  /** Current measured / observed value (string for display) */
  value?: string
  /** Threshold that must be satisfied */
  threshold?: string
  /** pass | fail | pending | n/a */
  status: 'pass' | 'fail' | 'pending' | 'na'
}

export interface RolloutStep {
  weight: number         // traffic % for this step (canary portion)
  label: string          // "5% → 20% → 50% → 100%"
  conditions: RolloutCondition[]
  status: 'completed' | 'active' | 'pending' | 'failed'
  completedAt?: number
}

export interface RolloutPolicy {
  strategy: 'canary' | 'blue-green' | 'ring' | 'shadow'
  /** Total steps in the rollout ladder */
  steps: RolloutStep[]
  /** Index of currently active step (0-based) */
  currentStep: number
  /** Auto-promote when all conditions pass */
  autoPromote: boolean
  /** Rollback automatically on condition failure */
  autoRollback: boolean
  /** Soak time required at each step before promotion (ms) */
  soakMs: number
}

export interface ServiceVersion {
  version: string
  deployedAt: number
  status: 'stable' | 'canary' | 'shadow' | 'retired'
  /** traffic weight 0–100 */
  weight: number
  commitSha?: string
  changelog?: string
}

export interface ObsNodeData extends Record<string, unknown> {
  id: string
  serviceName: string
  displayName: string
  team: string
  runtime: string
  tier: NodeTier
  kind: NodeKind
  health: ServiceHealth
  activeVersion: string
  stableVersion: string
  deployStatus: DeployStatus | 'stable'
  /** canary weight 0–100; 0 if not in canary */
  canaryWeight: number
  stableWeight: number
  errorRate: number
  p99Latency: number
  requestsPerMin: number
  routingStrategy: 'canary' | 'blue-green' | 'ring' | 'none'
  /** Whether this node has full drill-down data */
  hasDemoDetail: boolean
  lastDeployedAt: number
  /** All versions currently running (stable + canary + shadow) */
  versions?: ServiceVersion[]
  /** Active rollout policy, present when deployStatus !== 'stable' */
  rolloutPolicy?: RolloutPolicy
}

export interface ObsEdgeData extends Record<string, unknown> {
  /** requests per second crossing this edge */
  reqPerSec: number
  /** true if the source service has an active rollout */
  isActiveRollout: boolean
  /** traffic split label to show on the edge, e.g. "20% canary" */
  splitLabel?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = Date.now()
const mins = (n: number) => n * 60 * 1000
const hours = (n: number) => n * 60 * mins(1)
const days = (n: number) => n * 24 * hours(1)

function demoService(name: string): Partial<ObsNodeData> {
  const svc = DEMO_SERVICES.find((s) => s.serviceName === name)
  if (!svc) return {}
  const latestDep = svc.deployments[0]
  return {
    health: svc.health,
    activeVersion: svc.activeVersion,
    stableVersion: svc.stableVersion,
    deployStatus:
      latestDep?.status === 'canary' || latestDep?.status === 'deploying'
        ? latestDep.status
        : latestDep?.status === 'failed'
        ? 'failed'
        : 'stable',
    canaryWeight: latestDep?.canaryWeight ?? 0,
    stableWeight: latestDep?.stableWeight ?? 100,
    errorRate: svc.errorRate,
    p99Latency: svc.p99Latency,
    requestsPerMin: svc.requestsPerMin,
    routingStrategy: svc.routingStrategy,
    hasDemoDetail: true,
    lastDeployedAt: svc.lastDeployedAt,
  }
}

// ─── Node Definitions ─────────────────────────────────────────────────────────

export const OBS_NODES: ObsNodeData[] = [
  // ── Tier 0: Ingress ──────────────────────────────────────────────────────
  {
    id: 'api-gateway',
    serviceName: 'api-gateway',
    displayName: 'API Gateway',
    team: 'platform-team',
    runtime: 'Node.js 22',
    tier: 0,
    kind: 'gateway',
    health: 'healthy',
    activeVersion: 'v2.4.2',
    stableVersion: 'v2.4.1',
    deployStatus: 'canary',
    canaryWeight: 25,
    stableWeight: 75,
    errorRate: 0.02,
    p99Latency: 118,
    requestsPerMin: 4820,
    routingStrategy: 'canary',
    hasDemoDetail: true,
    lastDeployedAt: NOW - mins(23),
    ...demoService('api-gateway'),
    versions: [
      { version: 'v2.4.2', deployedAt: NOW - mins(23), status: 'canary',  weight: 25, commitSha: 'a3f8c12', changelog: 'feat: rate-limit per-org header' },
      { version: 'v2.4.1', deployedAt: NOW - days(4),  status: 'stable',  weight: 75, commitSha: 'b9e21dd', changelog: 'fix: upstream timeout fallback' },
      { version: 'v2.4.0', deployedAt: NOW - days(12), status: 'retired', weight: 0,  commitSha: 'c12a04e', changelog: 'feat: gRPC proxying support' },
    ],
    rolloutPolicy: {
      strategy: 'canary',
      autoPromote: true,
      autoRollback: true,
      soakMs: mins(30),
      currentStep: 1,
      steps: [
        {
          weight: 5, label: '5%', status: 'completed', completedAt: NOW - mins(20),
          conditions: [
            { type: 'error_rate',    label: 'Error rate < 0.5%',  value: '0.02%',  threshold: '0.5%',  status: 'pass' },
            { type: 'request_count', label: 'Min 500 requests',   value: '1840',   threshold: '500',   status: 'pass' },
          ],
        },
        {
          weight: 25, label: '25%', status: 'active',
          conditions: [
            { type: 'error_rate',   label: 'Error rate < 0.5%',  value: '0.02%',  threshold: '0.5%',  status: 'pass' },
            { type: 'p99_latency',  label: 'p99 latency < 200ms', value: '118ms', threshold: '200ms', status: 'pass' },
            { type: 'time_window',  label: 'Business hours only', value: 'in window', threshold: 'Mon–Fri 09–18', status: 'pass' },
          ],
        },
        {
          weight: 50,  label: '50%',  status: 'pending', conditions: [
            { type: 'error_rate',  label: 'Error rate < 0.5%',   threshold: '0.5%',  status: 'pending' },
            { type: 'manual',      label: 'Team lead approval',                        status: 'pending' },
          ],
        },
        {
          weight: 100, label: '100%', status: 'pending', conditions: [
            { type: 'error_rate',  label: 'Error rate < 0.5%',   threshold: '0.5%',  status: 'pending' },
            { type: 'p99_latency', label: 'p99 latency < 200ms', threshold: '200ms', status: 'pending' },
          ],
        },
      ],
    },
  },
  {
    id: 'cdn-edge',
    serviceName: 'cdn-edge',
    displayName: 'CDN Edge',
    team: 'platform-team',
    runtime: 'Fastly VCL',
    tier: 0,
    kind: 'gateway',
    health: 'healthy',
    activeVersion: 'v1.2.0',
    stableVersion: 'v1.2.0',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 8,
    requestsPerMin: 18400,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(12),
  },

  // ── Tier 1: Core Services ────────────────────────────────────────────────
  {
    id: 'auth-service',
    serviceName: 'auth-service',
    displayName: 'Auth Service',
    team: 'security-team',
    runtime: 'Go 1.22',
    tier: 1,
    kind: 'service',
    health: 'degraded',
    activeVersion: 'v3.1.1',
    stableVersion: 'v3.1.0',
    deployStatus: 'canary',
    canaryWeight: 10,
    stableWeight: 90,
    errorRate: 0.38,
    p99Latency: 198,
    requestsPerMin: 2100,
    routingStrategy: 'canary',
    hasDemoDetail: true,
    lastDeployedAt: NOW - mins(7),
    ...demoService('auth-service'),
    versions: [
      { version: 'v3.1.1', deployedAt: NOW - mins(7),  status: 'canary',  weight: 10, commitSha: 'd4c9011', changelog: 'fix: JWT refresh race condition' },
      { version: 'v3.1.0', deployedAt: NOW - days(2),  status: 'stable',  weight: 90, commitSha: 'e7f3a88', changelog: 'feat: PKCE flow for SPAs' },
      { version: 'v3.0.9', deployedAt: NOW - days(10), status: 'retired', weight: 0,  commitSha: 'f01b22c', changelog: 'chore: dependency bumps' },
    ],
    rolloutPolicy: {
      strategy: 'canary',
      autoPromote: false,
      autoRollback: true,
      soakMs: mins(15),
      currentStep: 0,
      steps: [
        {
          weight: 10, label: '10%', status: 'active',
          conditions: [
            { type: 'error_rate',    label: 'Error rate < 0.2%',  value: '0.38%', threshold: '0.2%',  status: 'fail' },
            { type: 'p99_latency',   label: 'p99 latency < 150ms', value: '198ms', threshold: '150ms', status: 'fail' },
            { type: 'request_count', label: 'Min 200 requests',   value: '412',    threshold: '200',   status: 'pass' },
          ],
        },
        {
          weight: 50,  label: '50%',  status: 'pending', conditions: [
            { type: 'error_rate',  label: 'Error rate < 0.2%',   threshold: '0.2%',  status: 'pending' },
            { type: 'manual',      label: 'Security team approval',                   status: 'pending' },
          ],
        },
        {
          weight: 100, label: '100%', status: 'pending', conditions: [
            { type: 'error_rate',  label: 'Error rate < 0.2%',   threshold: '0.2%',  status: 'pending' },
          ],
        },
      ],
    },
  },
  {
    id: 'payment-service',
    serviceName: 'payment-service',
    displayName: 'Payment Service',
    team: 'payments-team',
    runtime: 'Node.js 22',
    tier: 1,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v1.9.4',
    stableVersion: 'v1.9.4',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 94,
    requestsPerMin: 1240,
    routingStrategy: 'canary',
    hasDemoDetail: true,
    lastDeployedAt: NOW - hours(14),
    ...demoService('payment-service'),
  },
  {
    id: 'user-service',
    serviceName: 'user-service',
    displayName: 'User Service',
    team: 'platform-team',
    runtime: 'Go 1.22',
    tier: 1,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v5.3.0',
    stableVersion: 'v5.3.0',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.01,
    p99Latency: 62,
    requestsPerMin: 3100,
    routingStrategy: 'canary',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(3),
  },
  {
    id: 'search-service',
    serviceName: 'search-service',
    displayName: 'Search Service',
    team: 'platform-team',
    runtime: 'Java 21',
    tier: 1,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v1.4.2',
    stableVersion: 'v1.4.2',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 72,
    requestsPerMin: 920,
    routingStrategy: 'canary',
    hasDemoDetail: true,
    lastDeployedAt: NOW - days(6),
    ...demoService('search-service'),
  },
  {
    id: 'notification-service',
    serviceName: 'notification-service',
    displayName: 'Notification Service',
    team: 'infra-team',
    runtime: 'Python 3.12',
    tier: 1,
    kind: 'service',
    health: 'incident',
    activeVersion: 'v2.0.1',
    stableVersion: 'v2.0.0',
    deployStatus: 'failed',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 3.2,
    p99Latency: 1840,
    requestsPerMin: 560,
    routingStrategy: 'blue-green',
    hasDemoDetail: true,
    lastDeployedAt: NOW - mins(41),
    ...demoService('notification-service'),
  },

  // ── Tier 2: Internal Services ────────────────────────────────────────────
  {
    id: 'billing-service',
    serviceName: 'billing-service',
    displayName: 'Billing Service',
    team: 'payments-team',
    runtime: 'Node.js 22',
    tier: 2,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v3.0.4',
    stableVersion: 'v3.0.4',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 88,
    requestsPerMin: 410,
    routingStrategy: 'canary',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(4),
  },
  {
    id: 'job-worker',
    serviceName: 'job-worker',
    displayName: 'Job Worker',
    team: 'platform-team',
    runtime: 'Node.js 22',
    tier: 2,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v4.2.0',
    stableVersion: 'v4.2.0',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 44,
    requestsPerMin: 380,
    routingStrategy: 'ring',
    hasDemoDetail: true,
    lastDeployedAt: NOW - days(1) - hours(2),
    ...demoService('job-worker'),
  },
  {
    id: 'analytics-pipeline',
    serviceName: 'analytics-pipeline',
    displayName: 'Analytics Pipeline',
    team: 'data-team',
    runtime: 'Python 3.12',
    tier: 2,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v2.1.3',
    stableVersion: 'v2.1.3',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 320,
    requestsPerMin: 140,
    routingStrategy: 'ring',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(8),
  },
  {
    id: 'recommendation-engine',
    serviceName: 'recommendation-engine',
    displayName: 'Recommendation Engine',
    team: 'data-team',
    runtime: 'Python 3.12',
    tier: 2,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v1.8.0',
    stableVersion: 'v1.7.5',
    deployStatus: 'canary',
    canaryWeight: 15,
    stableWeight: 85,
    errorRate: 0.05,
    p99Latency: 210,
    requestsPerMin: 680,
    routingStrategy: 'canary',
    hasDemoDetail: false,
    lastDeployedAt: NOW - hours(3),
    versions: [
      { version: 'v1.8.0', deployedAt: NOW - hours(3),  status: 'canary',  weight: 15, commitSha: '9a1bc34', changelog: 'feat: collaborative filtering v2' },
      { version: 'v1.7.5', deployedAt: NOW - days(5),   status: 'stable',  weight: 85, commitSha: '8d02fa1', changelog: 'perf: embedding cache warm-up' },
    ],
    rolloutPolicy: {
      strategy: 'canary',
      autoPromote: true,
      autoRollback: false,
      soakMs: mins(60),
      currentStep: 0,
      steps: [
        {
          weight: 15, label: '15%', status: 'active',
          conditions: [
            { type: 'error_rate',    label: 'Error rate < 0.5%',  value: '0.05%', threshold: '0.5%',  status: 'pass' },
            { type: 'p99_latency',   label: 'p99 latency < 300ms', value: '210ms', threshold: '300ms', status: 'pass' },
            { type: 'header_match',  label: 'X-Beta: true users',  value: '~15%',  threshold: 'header', status: 'pass' },
          ],
        },
        {
          weight: 50,  label: '50%',  status: 'pending', conditions: [
            { type: 'error_rate', label: 'Error rate < 0.5%',    threshold: '0.5%',  status: 'pending' },
            { type: 'time_window', label: 'Off-peak hours only', threshold: '00–06 UTC', status: 'pending' },
          ],
        },
        {
          weight: 100, label: '100%', status: 'pending', conditions: [
            { type: 'error_rate',  label: 'Error rate < 0.5%',   threshold: '0.5%',  status: 'pending' },
            { type: 'p99_latency', label: 'p99 latency < 300ms', threshold: '300ms', status: 'pending' },
            { type: 'manual',      label: 'Data team sign-off',                       status: 'pending' },
          ],
        },
      ],
    },
  },
  {
    id: 'feature-flags',
    serviceName: 'feature-flags',
    displayName: 'Feature Flags',
    team: 'platform-team',
    runtime: 'Go 1.22',
    tier: 2,
    kind: 'service',
    health: 'healthy',
    activeVersion: 'v1.1.2',
    stableVersion: 'v1.1.2',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 14,
    requestsPerMin: 12400,
    routingStrategy: 'canary',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(14),
  },

  // ── Tier 3: Data / External ──────────────────────────────────────────────
  {
    id: 'postgres-primary',
    serviceName: 'postgres-primary',
    displayName: 'Postgres',
    team: 'infra-team',
    runtime: 'PostgreSQL 16',
    tier: 3,
    kind: 'datastore',
    health: 'healthy',
    activeVersion: '16.2',
    stableVersion: '16.2',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 4,
    requestsPerMin: 28000,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(30),
  },
  {
    id: 'redis-cluster',
    serviceName: 'redis-cluster',
    displayName: 'Redis',
    team: 'infra-team',
    runtime: 'Redis 7.2',
    tier: 3,
    kind: 'datastore',
    health: 'healthy',
    activeVersion: '7.2',
    stableVersion: '7.2',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 1,
    requestsPerMin: 64000,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(45),
  },
  {
    id: 'elasticsearch',
    serviceName: 'elasticsearch',
    displayName: 'Elasticsearch',
    team: 'data-team',
    runtime: 'Elastic 8.12',
    tier: 3,
    kind: 'datastore',
    health: 'healthy',
    activeVersion: '8.12',
    stableVersion: '8.12',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 18,
    requestsPerMin: 4400,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW - days(22),
  },
  {
    id: 's3-store',
    serviceName: 's3-store',
    displayName: 'S3 Storage',
    team: 'infra-team',
    runtime: 'AWS S3',
    tier: 3,
    kind: 'external',
    health: 'healthy',
    activeVersion: 'managed',
    stableVersion: 'managed',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 22,
    requestsPerMin: 1800,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW,
  },
  {
    id: 'stripe-api',
    serviceName: 'stripe-api',
    displayName: 'Stripe',
    team: 'payments-team',
    runtime: 'External API',
    tier: 3,
    kind: 'external',
    health: 'healthy',
    activeVersion: 'v1',
    stableVersion: 'v1',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 0.00,
    p99Latency: 340,
    requestsPerMin: 280,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW,
  },
  {
    id: 'sendgrid',
    serviceName: 'sendgrid',
    displayName: 'SendGrid',
    team: 'infra-team',
    runtime: 'External API',
    tier: 3,
    kind: 'external',
    health: 'incident',
    activeVersion: 'v3',
    stableVersion: 'v3',
    deployStatus: 'stable',
    canaryWeight: 0,
    stableWeight: 100,
    errorRate: 2.8,
    p99Latency: 1200,
    requestsPerMin: 0,
    routingStrategy: 'none',
    hasDemoDetail: false,
    lastDeployedAt: NOW,
  },
]

// ─── Edge Definitions ─────────────────────────────────────────────────────────

export interface ObsEdge {
  id: string
  source: string
  target: string
  data: ObsEdgeData
}

export const OBS_EDGES: ObsEdge[] = [
  // CDN Edge → API Gateway
  { id: 'e-cdn-apigw',      source: 'cdn-edge',              target: 'api-gateway',          data: { reqPerSec: 306, isActiveRollout: false } },

  // API Gateway → core services
  { id: 'e-apigw-auth',     source: 'api-gateway',           target: 'auth-service',         data: { reqPerSec: 35,  isActiveRollout: true,  splitLabel: '25% new' } },
  { id: 'e-apigw-user',     source: 'api-gateway',           target: 'user-service',         data: { reqPerSec: 52,  isActiveRollout: true,  splitLabel: '25% new' } },
  { id: 'e-apigw-pay',      source: 'api-gateway',           target: 'payment-service',      data: { reqPerSec: 21,  isActiveRollout: true,  splitLabel: '25% new' } },
  { id: 'e-apigw-search',   source: 'api-gateway',           target: 'search-service',       data: { reqPerSec: 15,  isActiveRollout: true,  splitLabel: '25% new' } },
  { id: 'e-apigw-notif',    source: 'api-gateway',           target: 'notification-service', data: { reqPerSec: 9,   isActiveRollout: true,  splitLabel: '25% new' } },

  // Auth → feature-flags (tier 2)
  { id: 'e-auth-ff',        source: 'auth-service',          target: 'feature-flags',        data: { reqPerSec: 207, isActiveRollout: true,  splitLabel: '10% new' } },
  { id: 'e-auth-pg',        source: 'auth-service',          target: 'postgres-primary',     data: { reqPerSec: 82,  isActiveRollout: true,  splitLabel: '10% new' } },
  { id: 'e-auth-redis',     source: 'auth-service',          target: 'redis-cluster',        data: { reqPerSec: 140, isActiveRollout: true,  splitLabel: '10% new' } },

  // User → downstream
  { id: 'e-user-pg',        source: 'user-service',          target: 'postgres-primary',     data: { reqPerSec: 110, isActiveRollout: false } },
  { id: 'e-user-redis',     source: 'user-service',          target: 'redis-cluster',        data: { reqPerSec: 95,  isActiveRollout: false } },
  { id: 'e-user-notif',     source: 'user-service',          target: 'notification-service', data: { reqPerSec: 6,   isActiveRollout: false } },
  { id: 'e-user-analytics', source: 'user-service',          target: 'analytics-pipeline',   data: { reqPerSec: 8,   isActiveRollout: false } },

  // Payment → downstream
  { id: 'e-pay-billing',    source: 'payment-service',       target: 'billing-service',      data: { reqPerSec: 14,  isActiveRollout: false } },
  { id: 'e-pay-stripe',     source: 'payment-service',       target: 'stripe-api',           data: { reqPerSec: 5,   isActiveRollout: false } },
  { id: 'e-pay-pg',         source: 'payment-service',       target: 'postgres-primary',     data: { reqPerSec: 44,  isActiveRollout: false } },
  { id: 'e-pay-notif',      source: 'payment-service',       target: 'notification-service', data: { reqPerSec: 4,   isActiveRollout: false } },

  // Search → elasticsearch
  { id: 'e-search-es',      source: 'search-service',        target: 'elasticsearch',        data: { reqPerSec: 73,  isActiveRollout: false } },
  { id: 'e-search-redis',   source: 'search-service',        target: 'redis-cluster',        data: { reqPerSec: 28,  isActiveRollout: false } },

  // Notification → external
  { id: 'e-notif-sendgrid', source: 'notification-service',  target: 'sendgrid',             data: { reqPerSec: 0,   isActiveRollout: false } },
  { id: 'e-notif-worker',   source: 'notification-service',  target: 'job-worker',           data: { reqPerSec: 3,   isActiveRollout: false } },
  { id: 'e-notif-pg',       source: 'notification-service',  target: 'postgres-primary',     data: { reqPerSec: 12,  isActiveRollout: false } },

  // Billing → downstream
  { id: 'e-billing-pg',     source: 'billing-service',       target: 'postgres-primary',     data: { reqPerSec: 18,  isActiveRollout: false } },
  { id: 'e-billing-stripe', source: 'billing-service',       target: 'stripe-api',           data: { reqPerSec: 4,   isActiveRollout: false } },

  // Job Worker → storage
  { id: 'e-worker-s3',      source: 'job-worker',            target: 's3-store',             data: { reqPerSec: 12,  isActiveRollout: false } },
  { id: 'e-worker-pg',      source: 'job-worker',            target: 'postgres-primary',     data: { reqPerSec: 22,  isActiveRollout: false } },
  { id: 'e-worker-redis',   source: 'job-worker',            target: 'redis-cluster',        data: { reqPerSec: 38,  isActiveRollout: false } },

  // Analytics → storage
  { id: 'e-analytics-pg',   source: 'analytics-pipeline',    target: 'postgres-primary',     data: { reqPerSec: 6,   isActiveRollout: false } },
  { id: 'e-analytics-s3',   source: 'analytics-pipeline',    target: 's3-store',             data: { reqPerSec: 4,   isActiveRollout: false } },

  // Recommendation → search + redis
  { id: 'e-rec-es',         source: 'recommendation-engine', target: 'elasticsearch',        data: { reqPerSec: 28,  isActiveRollout: true, splitLabel: '15% new' } },
  { id: 'e-rec-redis',      source: 'recommendation-engine', target: 'redis-cluster',        data: { reqPerSec: 42,  isActiveRollout: true, splitLabel: '15% new' } },

  // Feature Flags → redis
  { id: 'e-ff-redis',       source: 'feature-flags',         target: 'redis-cluster',        data: { reqPerSec: 620, isActiveRollout: false } },
]

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function getNodeById(id: string): ObsNodeData | undefined {
  return OBS_NODES.find((n) => n.id === id)
}

/** Activity events for a specific service, newest first, max 6 */
export function getServiceActivity(serviceName: string) {
  return DEMO_ACTIVITY
    .filter((e) => e.service === serviceName)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6)
}

/** All system-level activity, newest first, max 8 */
export function getRecentActivity() {
  return DEMO_ACTIVITY.slice().sort((a, b) => b.ts - a.ts).slice(0, 8)
}

export const ACTIVE_ROLLOUT_NODES = OBS_NODES.filter(
  (n) => n.deployStatus === 'canary' || n.deployStatus === 'deploying'
)

export const INCIDENT_NODES = OBS_NODES.filter((n) => n.health === 'incident')

export const DEGRADED_NODES = OBS_NODES.filter((n) => n.health === 'degraded')

export const HEALTHY_NODES = OBS_NODES.filter((n) => n.health === 'healthy')
