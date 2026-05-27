/**
 * Billing types — mirrors the API's BillingGroup schemas.
 * Keep in sync with apps/api/src/api/groups/BillingGroup.ts.
 *
 * Model: Workspace (billing account) → Organizations → Projects → Services
 * Pricing: fixed subscription tiers + optional add-ons. No credits, no overages.
 */

// ── Plan tiers ─────────────────────────────────────────────────────────────────

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise'

export type SubStatus = 'active' | 'past_due' | 'canceled' | 'none'

// ── Plan limits ────────────────────────────────────────────────────────────────

export interface PlanLimits {
  services: number | null       // null = unlimited
  organizations: number | null
  projects: number | null
  seats: number | null
  environments: number | null
  retentionDays: number | null
}

// ── Feature gates ──────────────────────────────────────────────────────────────

export interface PlanFeatures {
  // Products
  titanRollouts: boolean
  titanRolloutsAdvanced: boolean  // cohort, DAG, dependency-aware
  titanShield: boolean
  titanShieldAdvanced: boolean    // automated rollback, anomaly triggers, guardrails
  titanForesightLite: boolean     // included on Scale
  titanPhoenix: boolean
  titanLedger: boolean
  // Orchestration
  dagReleaseCoordination: boolean
  cohortRouting: boolean
  multiEnvPromotion: boolean
  dependencyAwareReleases: boolean
  automatedRollbackPolicies: boolean
  deploymentFreezeWindows: boolean
  // Collaboration
  approvals: boolean
  releaseCoordination: boolean
  deploymentAuditTrail: boolean
  // Governance
  advancedRbac: boolean
  customPolicyEngine: boolean
  complianceReporting: boolean
  immutableHistory: boolean
  // Infrastructure
  ssoSaml: boolean
  onPremAvailable: boolean
  multiRegion: boolean
  // Integrations
  githubIntegration: boolean
  otelDatadog: boolean
  slackAlerts: boolean
  // Support
  supportTier: 'community' | 'email' | 'priority' | 'dedicated'
  sla: string | null
}

// ── Plan product ───────────────────────────────────────────────────────────────

export interface BillingProduct {
  id: string
  tier: PlanTier
  name: string
  tagline: string
  priceMonthly: number | null     // cents; null = custom quote
  priceAnnual: number | null      // cents; null = custom quote
  annualSavingsPct: number | null
  isHighlighted: boolean
  isCustom: boolean
  isFree: boolean
  limits: PlanLimits
  features: PlanFeatures
}

// ── Add-ons ────────────────────────────────────────────────────────────────────

export type AddOnId =
  | 'extra_services_25'
  | 'extra_services_100'
  | 'titan_foresight'
  | 'titan_sandbox'
  | 'self_hosted'
  | 'compliance_pack'
  | 'extra_org'

export interface AddOn {
  id: AddOnId
  name: string
  description: string
  priceMonthly: number | null     // cents; null = contact sales
  quantityUnit: string            // e.g. "+25 services/mo"
  isContactSales: boolean
}

// ── API response ───────────────────────────────────────────────────────────────

export interface BillingProductsResponse {
  products: BillingProduct[]
  addOns: AddOn[]
}

// ── Usage (operational metrics — not credit consumption) ───────────────────────

export interface UsageDimension {
  used: number
  limit: number | null            // null = unlimited
}

export interface BillingUsage {
  period: { start: string; end: string }
  services: UsageDimension
  organizations: UsageDimension
  projects: UsageDimension
  seats: UsageDimension
  environments: UsageDimension
  // Operational event counts (informational, not metered)
  deploymentsThisPeriod: number
  rollbacksThisPeriod: number
  incidentsAutoResolved: number
  highRiskPrsFlagged: number
  policyChecksRun: number
}

// ── Canonical plan data ────────────────────────────────────────────────────────
// Used as fallback when the API is unavailable and as the source of truth
// for plan comparison UI. Keep in sync with DB seed data.

const BASE_FEATURES = {
  titanRollouts: true,
  titanShield: true,
  titanPhoenix: true,
  titanLedger: true,
  githubIntegration: true,
} as const

export const CANONICAL_PLANS: BillingProduct[] = [
  {
    id: 'plan_starter',
    tier: 'starter',
    name: 'Starter',
    tagline: 'For teams getting serious about deployments.',
    priceMonthly: 4900,
    priceAnnual: 47040,       // ~$3,920/yr — 20% off
    annualSavingsPct: 20,
    isHighlighted: false,
    isCustom: false,
    isFree: false,
    limits: {
      services: 10,
      organizations: 1,
      projects: 3,
      seats: 10,
      environments: 2,
      retentionDays: 14,
    },
    features: {
      ...BASE_FEATURES,
      titanRolloutsAdvanced: false,
      titanShieldAdvanced: false,
      titanForesightLite: false,
      dagReleaseCoordination: false,
      cohortRouting: false,
      multiEnvPromotion: false,
      dependencyAwareReleases: false,
      automatedRollbackPolicies: false,
      deploymentFreezeWindows: false,
      approvals: false,
      releaseCoordination: false,
      deploymentAuditTrail: true,
      advancedRbac: false,
      customPolicyEngine: false,
      complianceReporting: false,
      immutableHistory: false,
      ssoSaml: false,
      onPremAvailable: false,
      multiRegion: false,
      otelDatadog: false,
      slackAlerts: false,
      supportTier: 'community',
      sla: null,
    },
  },
  {
    id: 'plan_growth',
    tier: 'growth',
    name: 'Growth',
    tagline: 'For scaling engineering organizations.',
    priceMonthly: 49900,
    priceAnnual: 479040,      // ~$39,920/yr — 20% off
    annualSavingsPct: 20,
    isHighlighted: true,
    isCustom: false,
    isFree: false,
    limits: {
      services: 100,
      organizations: 5,
      projects: 25,
      seats: 50,
      environments: 10,
      retentionDays: 90,
    },
    features: {
      ...BASE_FEATURES,
      titanRolloutsAdvanced: true,
      titanShieldAdvanced: true,
      titanForesightLite: false,
      dagReleaseCoordination: true,
      cohortRouting: true,
      multiEnvPromotion: true,
      dependencyAwareReleases: true,
      automatedRollbackPolicies: true,
      deploymentFreezeWindows: true,
      approvals: true,
      releaseCoordination: true,
      deploymentAuditTrail: true,
      advancedRbac: false,
      customPolicyEngine: false,
      complianceReporting: false,
      immutableHistory: false,
      ssoSaml: false,
      onPremAvailable: false,
      multiRegion: false,
      otelDatadog: true,
      slackAlerts: true,
      supportTier: 'email',
      sla: '99.5%',
    },
  },
  {
    id: 'plan_scale',
    tier: 'scale',
    name: 'Scale',
    tagline: 'For platform and infrastructure teams.',
    priceMonthly: 249900,
    priceAnnual: 2399040,     // ~$199,920/yr — 20% off
    annualSavingsPct: 20,
    isHighlighted: false,
    isCustom: false,
    isFree: false,
    limits: {
      services: 500,
      organizations: 20,
      projects: 100,
      seats: 250,
      environments: null,
      retentionDays: 365,
    },
    features: {
      ...BASE_FEATURES,
      titanRolloutsAdvanced: true,
      titanShieldAdvanced: true,
      titanForesightLite: true,
      dagReleaseCoordination: true,
      cohortRouting: true,
      multiEnvPromotion: true,
      dependencyAwareReleases: true,
      automatedRollbackPolicies: true,
      deploymentFreezeWindows: true,
      approvals: true,
      releaseCoordination: true,
      deploymentAuditTrail: true,
      advancedRbac: true,
      customPolicyEngine: true,
      complianceReporting: true,
      immutableHistory: true,
      ssoSaml: true,
      onPremAvailable: false,
      multiRegion: true,
      otelDatadog: true,
      slackAlerts: true,
      supportTier: 'priority',
      sla: '99.9%',
    },
  },
  {
    id: 'plan_enterprise',
    tier: 'enterprise',
    name: 'Enterprise',
    tagline: 'For regulated and mission-critical systems.',
    priceMonthly: null,
    priceAnnual: null,
    annualSavingsPct: null,
    isHighlighted: false,
    isCustom: true,
    isFree: false,
    limits: {
      services: null,
      organizations: null,
      projects: null,
      seats: null,
      environments: null,
      retentionDays: null,
    },
    features: {
      ...BASE_FEATURES,
      titanRolloutsAdvanced: true,
      titanShieldAdvanced: true,
      titanForesightLite: true,
      dagReleaseCoordination: true,
      cohortRouting: true,
      multiEnvPromotion: true,
      dependencyAwareReleases: true,
      automatedRollbackPolicies: true,
      deploymentFreezeWindows: true,
      approvals: true,
      releaseCoordination: true,
      deploymentAuditTrail: true,
      advancedRbac: true,
      customPolicyEngine: true,
      complianceReporting: true,
      immutableHistory: true,
      ssoSaml: true,
      onPremAvailable: true,
      multiRegion: true,
      otelDatadog: true,
      slackAlerts: true,
      supportTier: 'dedicated',
      sla: '99.99%',
    },
  },
]

export const CANONICAL_ADDONS: AddOn[] = [
  {
    id: 'extra_services_25',
    name: 'Extra Services Pack',
    description: '+25 protected services',
    priceMonthly: 9900,
    quantityUnit: '+25 services/mo',
    isContactSales: false,
  },
  {
    id: 'extra_services_100',
    name: 'Extra Services Pack (100)',
    description: '+100 protected services',
    priceMonthly: 29900,
    quantityUnit: '+100 services/mo',
    isContactSales: false,
  },
  {
    id: 'titan_foresight',
    name: 'Titan Foresight',
    description: 'Deployment impact analysis, blast radius estimation, release risk scoring',
    priceMonthly: 29900,
    quantityUnit: 'per workspace/mo',
    isContactSales: false,
  },
  {
    id: 'titan_sandbox',
    name: 'Titan Sandbox',
    description: 'Ephemeral environments, historical replay, branch preview orchestration',
    priceMonthly: 19900,
    quantityUnit: 'per workspace/mo',
    isContactSales: false,
  },
  {
    id: 'compliance_pack',
    name: 'Compliance Pack',
    description: 'Audit exports, approval workflows, deployment attestations, compliance reporting',
    priceMonthly: 29900,
    quantityUnit: 'per workspace/mo',
    isContactSales: false,
  },
  {
    id: 'extra_org',
    name: 'Extra Organization',
    description: '+1 organization / team',
    priceMonthly: 4900,
    quantityUnit: '+1 org/mo',
    isContactSales: false,
  },
  {
    id: 'self_hosted',
    name: 'Self-Hosted Controller',
    description: 'On-prem deployment controller for air-gapped and regulated environments',
    priceMonthly: null,
    quantityUnit: 'per controller/mo',
    isContactSales: true,
  },
]
