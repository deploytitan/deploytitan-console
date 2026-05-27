'use client'

/**
 * Observatory page — live service dependency graph with deployment state.
 *
 * Three-zone layout:
 *   1. Header chrome: title + stat strip + environment filter
 *   2. Main canvas (70%): React Flow hierarchical service graph
 *   3. Detail panel (30%): system overview or selected service detail
 *
 * React Flow node/edge types are defined inline; no external graph lib needed.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  Handle,
  Position,
  getBezierPath,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  OBS_NODES,
  OBS_EDGES,
  getNodeById,
  getServiceActivity,
  getRecentActivity,
  ACTIVE_ROLLOUT_NODES,
  INCIDENT_NODES,
  HEALTHY_NODES,
  type ObsNodeData,
  type ObsEdgeData,
  type RolloutStep,
  type RolloutCondition,
  type ServiceVersion,
} from '../../lib/observatory-data'
import {
  HealthDot,
  MonoLabel,
  SloBar,
  StatStrip,
  DemoBanner,
  timeSince,
} from '../../components/console/ConsolePrimitives'
import { DEMO_SERVICES } from '../../lib/demo-data'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import {
  Network,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Pause,
  X,
  Activity,
  Rocket,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Circle,
  GitBranch,
  ArrowRight,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_X: Record<number, number> = { 0: 80, 1: 380, 2: 700, 3: 1020 }
const TIER_X_DEFAULT = 80
const NODE_WIDTH = 220
const NODE_HEIGHT_SERVICE = 88
const NODE_HEIGHT_DATA = 64
const TIER_Y_GAP = 112
const TIER_Y_START = 60

type EnvFilter = 'production' | 'staging' | 'preview'

// ─── Color helpers ────────────────────────────────────────────────────────────

function healthColor(health: ObsNodeData['health'], deployStatus: ObsNodeData['deployStatus']): string {
  if (deployStatus === 'failed') return 'var(--color-signal-danger)'
  if (health === 'incident') return 'var(--color-signal-danger)'
  if (health === 'degraded') return 'var(--color-signal-warning)'
  if (deployStatus === 'canary' || deployStatus === 'deploying') return 'var(--color-signal-deploy)'
  return 'var(--color-signal-success)'
}

function healthRingClass(health: ObsNodeData['health'], deployStatus: ObsNodeData['deployStatus']): string {
  if (deployStatus === 'failed' || health === 'incident') return 'ring-danger'
  if (health === 'degraded') return 'ring-warning'
  if (deployStatus === 'canary' || deployStatus === 'deploying') return 'ring-deploy'
  return 'ring-healthy'
}

function deployStatusLabel(status: ObsNodeData['deployStatus']): string {
  if (status === 'canary') return 'CANARY'
  if (status === 'deploying') return 'DEPLOYING'
  if (status === 'failed') return 'FAILED'
  if (status === 'rolled_back') return 'ROLLED BACK'
  if (status === 'completed') return 'DEPLOYED'
  return 'STABLE'
}

function deployStatusColor(status: ObsNodeData['deployStatus']): string {
  if (status === 'failed' || status === 'rolled_back') return 'text-signal-danger'
  if (status === 'canary' || status === 'deploying') return 'text-signal-deploy'
  if (status === 'completed') return 'text-signal-success'
  return 'text-ink-quaternary'
}

function activitySeverityColor(severity: 'info' | 'warn' | 'error'): string {
  if (severity === 'error') return 'text-signal-danger'
  if (severity === 'warn') return 'text-signal-warning'
  return 'text-ink-quaternary'
}

function edgeStrokeWidth(reqPerSec: number): number {
  if (reqPerSec >= 200) return 3.5
  if (reqPerSec >= 50) return 2.5
  if (reqPerSec >= 10) return 1.8
  return 1.2
}

// ─── Layout computation ───────────────────────────────────────────────────────

function computeLayout(): Node<ObsNodeData>[] {
  const tierCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  OBS_NODES.forEach((n) => {
    tierCounts[n.tier] = (tierCounts[n.tier] ?? 0) + 1
  })

  const tierIndex: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const maxTierCount = Math.max(...Object.values(tierCounts))

  return OBS_NODES.map((n) => {
    const idx = tierIndex[n.tier] ?? 0
    tierIndex[n.tier] = idx + 1
    const count = tierCounts[n.tier] ?? 1
    const isSmall = n.kind === 'datastore' || n.kind === 'external'
    const slotH = isSmall ? NODE_HEIGHT_DATA + 28 : NODE_HEIGHT_SERVICE + 24
    const tierH = count * slotH
    const maxH = maxTierCount * (NODE_HEIGHT_SERVICE + 24)
    const yOffset = (maxH - tierH) / 2

    return {
      id: n.id,
      type: isSmall ? 'dataNode' : 'serviceNode',
      position: { x: TIER_X[n.tier] ?? TIER_X_DEFAULT, y: TIER_Y_START + yOffset + idx * slotH },
      data: n,
      draggable: false,
      selectable: !isSmall,
    }
  })
}

function buildEdges(): Edge<ObsEdgeData>[] {
  return OBS_EDGES.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'trafficEdge',
    data: e.data,
    animated: false,
  }))
}

// ─── Custom Node: ServiceNode ─────────────────────────────────────────────────

function ServiceNode({ data, selected }: NodeProps & { data: ObsNodeData }) {
  const isActive = data.deployStatus === 'canary' || data.deployStatus === 'deploying'
  const isDanger = data.health === 'incident' || data.deployStatus === 'failed'
  const isDegraded = data.health === 'degraded'
  const ringColor = healthColor(data.health, data.deployStatus)
  const hasMultiVersion = (data.versions?.filter(v => v.status !== 'retired').length ?? 0) > 1

  return (
    <div
      className="obs-service-node"
      style={{
        width: NODE_WIDTH,
        background: 'var(--color-surface-alt)',
        border: selected
          ? `1.5px solid var(--color-gold)`
          : isDanger
          ? `1.5px solid color-mix(in oklch, var(--color-signal-danger) 40%, transparent)`
          : `1px solid var(--color-line)`,
        borderRadius: 4,
        padding: '12px 14px 10px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
        boxShadow: selected
          ? `0 0 0 3px color-mix(in oklch, var(--color-gold) 12%, transparent)`
          : isDanger
          ? `0 0 0 2px color-mix(in oklch, var(--color-signal-danger) 8%, transparent)`
          : 'none',
      }}
    >
      {/* Status ring stripe */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 3,
        bottom: 0,
        borderRadius: '4px 0 0 4px',
        background: ringColor,
        opacity: isDanger ? 1 : isDegraded ? 0.9 : isActive ? 0.85 : 0.5,
      }} />

      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontFamily: 'Instrument Sans, system-ui, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-ink)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>
            {data.displayName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasMultiVersion && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                padding: '1px 4px',
                background: 'color-mix(in oklch, var(--color-signal-deploy) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--color-signal-deploy) 25%, transparent)',
                borderRadius: 2,
                fontFamily: 'JetBrains Mono', fontSize: 7,
                color: 'var(--color-signal-deploy)',
                letterSpacing: '0.04em',
              }}>
                {data.versions!.filter(v => v.status !== 'retired').length}v
              </span>
            )}
            <HealthDot health={data.health} />
          </div>
        </div>

        {/* Team + version row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isActive ? 8 : 6 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: 'var(--color-ink-quaternary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {data.team}
          </span>
          <span style={{ color: 'var(--color-line)', fontSize: 8 }}>·</span>
          {isActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-ink-tertiary)' }}>
                {data.stableVersion}
              </span>
              <ArrowRight size={8} style={{ color: 'var(--color-signal-deploy)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-signal-deploy)', fontWeight: 600 }}>
                {data.activeVersion}
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-ink-tertiary)' }}>
              {data.activeVersion}
            </span>
          )}
        </div>

        {/* Traffic split bar (for canary nodes) */}
        {isActive && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex',
              height: 4,
              borderRadius: 1,
              overflow: 'hidden',
              background: 'var(--color-line)',
              gap: 1,
            }}>
              <div
                className="obs-split-bar-canary"
                style={{
                  width: `${data.canaryWeight}%`,
                  background: 'var(--color-signal-deploy)',
                  borderRadius: '1px 0 0 1px',
                  transition: 'width 400ms ease-out',
                }}
              />
              <div style={{
                flex: 1,
                background: 'var(--color-signal-success)',
                opacity: 0.6,
              }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 3,
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 8,
                color: 'var(--color-signal-deploy)',
              }}>
                {data.canaryWeight}% canary
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 8,
                color: 'var(--color-ink-quaternary)',
              }}>
                {data.stableWeight}% stable
              </span>
            </div>
          </div>
        )}

        {/* Status chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: ringColor,
            opacity: 0.9,
          }}>
            {deployStatusLabel(data.deployStatus)}
          </span>
          {isDanger && (
            <AlertTriangle size={8} style={{ color: 'var(--color-signal-danger)', flexShrink: 0 }} />
          )}
          {isActive && data.rolloutPolicy && (
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'JetBrains Mono', fontSize: 7,
              color: 'var(--color-ink-quaternary)',
            }}>
              step {data.rolloutPolicy.currentStep + 1}/{data.rolloutPolicy.steps.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Custom Node: DataNode (Tier 3 — stores / external) ───────────────────────

function DataNode({ data }: NodeProps & { data: ObsNodeData }) {
  const isDanger = data.health === 'incident'
  const ringColor = healthColor(data.health, data.deployStatus)

  return (
    <div
      style={{
        width: NODE_WIDTH,
        background: 'color-mix(in oklch, var(--color-surface-alt) 70%, transparent)',
        border: isDanger
          ? `1px solid color-mix(in oklch, var(--color-signal-danger) 30%, transparent)`
          : `1px solid color-mix(in oklch, var(--color-line) 60%, transparent)`,
        borderRadius: 4,
        padding: '9px 12px',
        position: 'relative',
        opacity: 0.75,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 2, bottom: 0,
        borderRadius: '4px 0 0 4px',
        background: ringColor, opacity: 0.4,
      }} />

      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{ paddingLeft: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'Instrument Sans, system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-ink-secondary)',
            marginBottom: 2,
          }}>
            {data.displayName}
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8,
            color: 'var(--color-ink-quaternary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {data.kind === 'external' ? 'external' : 'datastore'} · {data.runtime}
          </div>
        </div>
        <HealthDot health={data.health} />
      </div>
    </div>
  )
}

// ─── Custom Edge: TrafficEdge ─────────────────────────────────────────────────

function TrafficEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
}: EdgeProps & { data: ObsEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const strokeW = edgeStrokeWidth(data?.reqPerSec ?? 0)
  const isActive = data?.isActiveRollout ?? false
  const splitLabel = data?.splitLabel
  const strokeColor = isActive
    ? 'color-mix(in oklch, var(--color-signal-deploy) 60%, transparent)'
    : 'color-mix(in oklch, var(--color-line) 80%, transparent)'

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {isActive && (
        <circle r={3} fill="var(--color-signal-deploy)" opacity={0.9}>
          <animateMotion dur="2.4s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {isActive && splitLabel && (
        <foreignObject
          x={labelX - 22}
          y={labelY - 9}
          width={44}
          height={18}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 4px',
            background: 'var(--color-surface-alt)',
            border: '1px solid color-mix(in oklch, var(--color-signal-deploy) 35%, transparent)',
            borderRadius: 2,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 7,
            color: 'var(--color-signal-deploy)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}>
            {splitLabel}
          </div>
        </foreignObject>
      )}
    </>
  )
}

// ─── Node / Edge type maps ─────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNode as React.ComponentType<NodeProps>,
  dataNode: DataNode as React.ComponentType<NodeProps>,
}

const edgeTypes: EdgeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trafficEdge: TrafficEdge as any,
}

// ─── Detail Panel: System Overview ───────────────────────────────────────────

function SystemOverviewPanel() {
  const recentActivity = getRecentActivity()

  return (
    <div className="obs-detail-panel" style={{ height: '100%', overflowY: 'auto', padding: '24px 20px' }}>
      {/* Section: Active rollouts */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-line)',
        }}>
          <Rocket size={11} style={{ color: 'var(--color-ink-tertiary)' }} />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--color-ink-tertiary)',
          }}>Active Rollouts</span>
        </div>

        {ACTIVE_ROLLOUT_NODES.length === 0 ? (
          <p style={{ fontFamily: 'Instrument Sans', fontSize: 12, color: 'var(--color-ink-quaternary)', fontStyle: 'italic' }}>
            No active rollouts. All services at stable.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTIVE_ROLLOUT_NODES.map((node) => (
              <div key={node.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'color-mix(in oklch, var(--color-signal-deploy) 5%, var(--color-surface-alt))',
                border: '1px solid color-mix(in oklch, var(--color-signal-deploy) 20%, transparent)',
                borderRadius: 4,
              }}>
                <div>
                  <div style={{ fontFamily: 'Instrument Sans', fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 2 }}>
                    {node.displayName}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-signal-deploy)' }}>
                    {node.stableVersion} → {node.activeVersion}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500,
                  color: 'var(--color-signal-deploy)',
                }}>
                  {node.canaryWeight}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: System health summary */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-line)',
        }}>
          <Activity size={11} style={{ color: 'var(--color-ink-tertiary)' }} />
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-ink-tertiary)',
          }}>System Health</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Healthy', count: HEALTHY_NODES.length, color: 'var(--color-signal-success)' },
            { label: 'Degraded', count: OBS_NODES.filter(n => n.health === 'degraded').length, color: 'var(--color-signal-warning)' },
            { label: 'Incident', count: INCIDENT_NODES.length, color: 'var(--color-signal-danger)' },
            { label: 'In Rollout', count: ACTIVE_ROLLOUT_NODES.length, color: 'var(--color-signal-deploy)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              padding: '10px 12px',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-line)',
              borderRadius: 4,
            }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 500, color, marginBottom: 2 }}>
                {count}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-ink-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Recent activity */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-line)',
        }}>
          <Clock size={11} style={{ color: 'var(--color-ink-tertiary)' }} />
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-ink-tertiary)',
          }}>Recent Activity</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recentActivity.map((event) => (
            <div key={event.id} style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--color-line-subtle)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  fontFamily: 'Instrument Sans', fontSize: 11, fontWeight: 500,
                  color: 'var(--color-ink-secondary)', lineHeight: 1.3,
                }}>
                  {event.title}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: 8,
                  color: 'var(--color-ink-quaternary)',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {timeSince(event.ts)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {event.service && (
                  <span style={{
                    fontFamily: 'JetBrains Mono', fontSize: 8,
                    color: activitySeverityColor(event.severity),
                    letterSpacing: '0.04em',
                  }}>
                    {event.service}
                  </span>
                )}
                <span style={{ fontFamily: 'Instrument Sans', fontSize: 10, color: 'var(--color-ink-tertiary)', lineHeight: 1.3 }}>
                  {event.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel: Service Detail ─────────────────────────────────────────────

function conditionIcon(status: RolloutCondition['status']) {
  if (status === 'pass') return <CheckCircle2 size={10} style={{ color: 'var(--color-signal-success)', flexShrink: 0 }} />
  if (status === 'fail') return <XCircle size={10} style={{ color: 'var(--color-signal-danger)', flexShrink: 0 }} />
  if (status === 'pending') return <Circle size={10} style={{ color: 'var(--color-ink-quaternary)', flexShrink: 0 }} />
  return <Circle size={10} style={{ color: 'var(--color-line)', flexShrink: 0 }} />
}

function stepStatusColor(status: RolloutStep['status']): string {
  if (status === 'completed') return 'var(--color-signal-success)'
  if (status === 'active') return 'var(--color-signal-deploy)'
  if (status === 'failed') return 'var(--color-signal-danger)'
  return 'var(--color-ink-quaternary)'
}

function versionStatusColor(status: 'stable' | 'canary' | 'shadow' | 'retired'): string {
  if (status === 'stable') return 'var(--color-signal-success)'
  if (status === 'canary') return 'var(--color-signal-deploy)'
  if (status === 'shadow') return 'var(--color-signal-warning)'
  return 'var(--color-ink-quaternary)'
}

function ServiceDetailPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const node = getNodeById(nodeId)
  if (!node) return null

  const isActive = node.deployStatus === 'canary' || node.deployStatus === 'deploying'
  const isDanger = node.health === 'incident' || node.deployStatus === 'failed'
  const isDegraded = node.health === 'degraded'
  const activity = getServiceActivity(node.serviceName)
  const demoSvc = DEMO_SERVICES.find((s) => s.serviceName === node.serviceName)
  const latestDep = demoSvc?.deployments[0]
  const ringColor = healthColor(node.health, node.deployStatus)

  const sectionLabel = (text: string) => (
    <div style={{
      fontFamily: 'JetBrains Mono', fontSize: 9,
      color: 'var(--color-ink-quaternary)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      marginBottom: 10,
      paddingBottom: 6,
      borderBottom: '1px solid var(--color-line)',
    }}>
      {text}
    </div>
  )

  return (
    <div className="obs-detail-panel animate-fade-in" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--color-line)',
        position: 'sticky', top: 0,
        background: 'var(--color-surface-alt)',
        zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 15, fontWeight: 500,
              color: 'var(--color-ink)',
              letterSpacing: '-0.015em',
              marginBottom: 4,
            }}>
              {node.displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'JetBrains Mono', fontSize: 9,
                color: 'var(--color-ink-quaternary)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {node.team}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '1px 5px',
                background: `color-mix(in oklch, ${ringColor} 10%, transparent)`,
                border: `1px solid color-mix(in oklch, ${ringColor} 25%, transparent)`,
                borderRadius: 2,
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: 8,
                  color: ringColor,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {deployStatusLabel(node.deployStatus)}
                </span>
              </span>
              <span style={{
                padding: '1px 5px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
                borderRadius: 2,
                fontFamily: 'JetBrains Mono', fontSize: 8,
                color: 'var(--color-ink-tertiary)',
              }}>
                {node.routingStrategy}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-ink-tertiary)', padding: 4, borderRadius: 2,
              display: 'flex', alignItems: 'center',
            }}
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* ── Version Timeline ── */}
        {node.versions && node.versions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {sectionLabel('Version History')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {node.versions.map((v) => (
                <div key={v.version} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px',
                  background: v.status === 'canary'
                    ? 'color-mix(in oklch, var(--color-signal-deploy) 6%, var(--color-surface))'
                    : v.status === 'stable'
                    ? 'var(--color-surface)'
                    : 'color-mix(in oklch, var(--color-line) 40%, var(--color-surface))',
                  border: v.status === 'canary'
                    ? '1px solid color-mix(in oklch, var(--color-signal-deploy) 25%, transparent)'
                    : '1px solid var(--color-line)',
                  borderRadius: 4,
                  opacity: v.status === 'retired' ? 0.5 : 1,
                }}>
                  {/* weight bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: v.changelog ? 4 : 0 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600,
                        color: versionStatusColor(v.status),
                      }}>
                        {v.version}
                      </span>
                      <span style={{
                        padding: '0px 4px',
                        background: `color-mix(in oklch, ${versionStatusColor(v.status)} 12%, transparent)`,
                        border: `1px solid color-mix(in oklch, ${versionStatusColor(v.status)} 28%, transparent)`,
                        borderRadius: 2,
                        fontFamily: 'JetBrains Mono', fontSize: 7,
                        color: versionStatusColor(v.status),
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        {v.status}
                      </span>
                      {v.weight > 0 && (
                        <span style={{
                          marginLeft: 'auto',
                          fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 600,
                          color: versionStatusColor(v.status),
                        }}>
                          {v.weight}%
                        </span>
                      )}
                    </div>
                    {/* weight bar */}
                    {v.weight > 0 && (
                      <div style={{
                        height: 3, borderRadius: 1,
                        background: 'var(--color-line)',
                        marginBottom: 4,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${v.weight}%`,
                          height: '100%',
                          background: versionStatusColor(v.status),
                          transition: 'width 500ms ease-out',
                        }} />
                      </div>
                    )}
                    {v.changelog && (
                      <div style={{
                        fontFamily: 'Instrument Sans', fontSize: 10,
                        color: 'var(--color-ink-tertiary)',
                        lineHeight: 1.4,
                      }}>
                        {v.changelog}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      {v.commitSha && (
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 8,
                          color: 'var(--color-ink-quaternary)',
                        }}>
                          {v.commitSha}
                        </span>
                      )}
                      <span style={{
                        fontFamily: 'JetBrains Mono', fontSize: 8,
                        color: 'var(--color-ink-quaternary)',
                        marginLeft: v.commitSha ? 'auto' : undefined,
                      }}>
                        {timeSince(v.deployedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rollout Policy Ladder ── */}
        {isActive && node.rolloutPolicy && (
          <div style={{ marginBottom: 20 }}>
            {sectionLabel(`Rollout Policy · ${node.rolloutPolicy.strategy}`)}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              fontFamily: 'JetBrains Mono', fontSize: 8,
              color: 'var(--color-ink-quaternary)',
            }}>
              {node.rolloutPolicy.autoPromote && (
                <span style={{
                  padding: '1px 5px',
                  background: 'color-mix(in oklch, var(--color-signal-success) 8%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-signal-success) 20%, transparent)',
                  borderRadius: 2, color: 'var(--color-signal-success)',
                }}>
                  auto-promote
                </span>
              )}
              {node.rolloutPolicy.autoRollback && (
                <span style={{
                  padding: '1px 5px',
                  background: 'color-mix(in oklch, var(--color-signal-warning) 8%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-signal-warning) 20%, transparent)',
                  borderRadius: 2, color: 'var(--color-signal-warning)',
                }}>
                  auto-rollback
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                soak {Math.round(node.rolloutPolicy.soakMs / 60000)}m
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {node.rolloutPolicy.steps.map((step, idx) => {
                const isStepActive = step.status === 'active'
                const isStepDone = step.status === 'completed'
                const isStepFailed = step.status === 'failed'
                const color = stepStatusColor(step.status)
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10 }}>
                    {/* Connector line + dot */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 20, height: 20,
                        borderRadius: '50%',
                        background: isStepActive
                          ? 'color-mix(in oklch, var(--color-signal-deploy) 15%, var(--color-surface-alt))'
                          : isStepDone
                          ? 'color-mix(in oklch, var(--color-signal-success) 10%, var(--color-surface-alt))'
                          : 'var(--color-surface)',
                        border: `1.5px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontFamily: 'JetBrains Mono', fontWeight: 700,
                        color,
                        marginTop: 2,
                      }}>
                        {isStepDone ? '✓' : isStepFailed ? '✗' : idx + 1}
                      </div>
                      {idx < node.rolloutPolicy!.steps.length - 1 && (
                        <div style={{
                          width: 1, flex: 1, minHeight: 8,
                          background: isStepDone ? 'var(--color-signal-success)' : 'var(--color-line)',
                          opacity: isStepDone ? 0.4 : 0.5,
                          margin: '2px 0',
                        }} />
                      )}
                    </div>

                    {/* Step content */}
                    <div style={{
                      flex: 1, paddingBottom: idx < node.rolloutPolicy!.steps.length - 1 ? 12 : 0,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginTop: 4,
                      }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 600,
                          color,
                        }}>
                          {step.weight}%
                        </span>
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 8,
                          color: 'var(--color-ink-quaternary)',
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}>
                          {step.status}
                        </span>
                        {step.completedAt && (
                          <span style={{
                            marginLeft: 'auto',
                            fontFamily: 'JetBrains Mono', fontSize: 8,
                            color: 'var(--color-ink-quaternary)',
                          }}>
                            {timeSince(step.completedAt)}
                          </span>
                        )}
                      </div>
                      {/* Conditions */}
                      {(isStepActive || isStepFailed) && step.conditions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {step.conditions.map((cond, ci) => (
                            <div key={ci} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 8px',
                              background: cond.status === 'fail'
                                ? 'color-mix(in oklch, var(--color-signal-danger) 6%, var(--color-surface))'
                                : 'var(--color-surface)',
                              border: cond.status === 'fail'
                                ? '1px solid color-mix(in oklch, var(--color-signal-danger) 20%, transparent)'
                                : '1px solid var(--color-line)',
                              borderRadius: 2,
                            }}>
                              {conditionIcon(cond.status)}
                              <span style={{
                                fontFamily: 'Instrument Sans', fontSize: 10,
                                color: 'var(--color-ink-secondary)',
                                flex: 1,
                              }}>
                                {cond.label}
                              </span>
                              {cond.value && (
                                <span style={{
                                  fontFamily: 'JetBrains Mono', fontSize: 9,
                                  color: cond.status === 'fail' ? 'var(--color-signal-danger)' : 'var(--color-ink-tertiary)',
                                  flexShrink: 0,
                                }}>
                                  {cond.value}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Traffic split (canary) — compact version when rollout policy present */}
        {isActive && !node.rolloutPolicy && (
          <div style={{ marginBottom: 20 }}>
            {sectionLabel('Traffic Split')}
            <div style={{
              height: 8, borderRadius: 1, overflow: 'hidden',
              display: 'flex', gap: 1,
              background: 'var(--color-line)',
            }}>
              <div style={{
                width: `${node.canaryWeight}%`,
                background: 'var(--color-signal-deploy)',
                transition: 'width 500ms ease-out',
              }} />
              <div style={{
                flex: 1,
                background: 'color-mix(in oklch, var(--color-signal-success) 70%, transparent)',
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 4,
              fontFamily: 'JetBrains Mono', fontSize: 8,
              color: 'var(--color-ink-quaternary)',
            }}>
              <span style={{ color: 'var(--color-signal-deploy)' }}>{node.canaryWeight}% canary</span>
              <span>{node.stableWeight}% stable</span>
            </div>
          </div>
        )}

        {/* SLO bars */}
        <div style={{ marginBottom: 20 }}>
          {sectionLabel('SLO Status')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SloBar label="Error Rate" value={node.errorRate} threshold={0.5} unit="%" higherIsBad={true} />
            <SloBar label="p99 Latency" value={node.p99Latency} threshold={250} unit="ms" higherIsBad={true} />
          </div>
        </div>

        {/* Metrics */}
        <div style={{
          marginBottom: 20,
          padding: '10px 12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 4,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Req / min', value: node.requestsPerMin.toLocaleString(), color: 'var(--color-ink)' },
              { label: 'Error rate', value: `${node.errorRate}%`, color: isDanger ? 'var(--color-signal-danger)' : isDegraded ? 'var(--color-signal-warning)' : 'var(--color-ink)' },
              { label: 'p99 latency', value: `${node.p99Latency}ms`, color: node.p99Latency > 250 ? 'var(--color-signal-warning)' : 'var(--color-ink)' },
              { label: 'Runtime', value: node.runtime, color: 'var(--color-ink-secondary)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'var(--color-ink-quaternary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 500, color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promotion gates (demo data) */}
        {latestDep && latestDep.gates && latestDep.gates.length > 0 && !node.rolloutPolicy && (
          <div style={{ marginBottom: 20 }}>
            {sectionLabel('Promotion Gates')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {latestDep.gates.map((gate) => {
                const gateColor = gate.status === 'passed' ? 'var(--color-signal-success)'
                  : gate.status === 'failed' ? 'var(--color-signal-danger)'
                  : gate.status === 'pending' ? 'var(--color-signal-warning)'
                  : 'var(--color-ink-quaternary)'
                return (
                  <div key={gate.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 2,
                  }}>
                    <span style={{ fontFamily: 'Instrument Sans', fontSize: 11, color: 'var(--color-ink-secondary)' }}>
                      {gate.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--color-ink-tertiary)' }}>
                        {gate.value}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: gateColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {gate.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent activity */}
        {activity.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {sectionLabel('Recent Events')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activity.map((event) => (
                <div key={event.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--color-line-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'Instrument Sans', fontSize: 11, fontWeight: 500, color: 'var(--color-ink-secondary)' }}>
                      {event.title}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'var(--color-ink-quaternary)', flexShrink: 0 }}>
                      {timeSince(event.ts)}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'Instrument Sans', fontSize: 10, color: activitySeverityColor(event.severity) }}>
                    {event.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        {(isActive || isDanger) && (
          <div style={{ marginTop: 4 }}>
            {sectionLabel('Actions')}
            <div style={{ display: 'flex', gap: 8 }}>
              {isActive && (
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'Instrument Sans', fontSize: 12, fontWeight: 500,
                    color: 'var(--color-ink-secondary)',
                    transition: 'border-color 150ms ease-out',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gold)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--color-ink)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--color-ink-secondary)'
                  }}
                >
                  <Pause size={12} />
                  Pause Rollout
                </button>
              )}
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: 'color-mix(in oklch, var(--color-signal-danger) 8%, var(--color-surface))',
                  border: '1px solid color-mix(in oklch, var(--color-signal-danger) 20%, transparent)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'Instrument Sans', fontSize: 12, fontWeight: 500,
                  color: 'var(--color-signal-danger)',
                  transition: 'background 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--color-signal-danger) 15%, var(--color-surface))'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--color-signal-danger) 8%, var(--color-surface))'
                }}
              >
                <RotateCcw size={12} />
                Rollback
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Environment Filter ───────────────────────────────────────────────────────

function EnvFilter({ active, onChange }: { active: EnvFilter; onChange: (e: EnvFilter) => void }) {
  const envs: { id: EnvFilter; label: string }[] = [
    { id: 'production', label: 'Production' },
    { id: 'staging',    label: 'Staging' },
    { id: 'preview',    label: 'Preview' },
  ]

  return (
    <div style={{
      display: 'flex', gap: 2,
      padding: '2px',
      background: 'var(--color-surface-alt)',
      border: '1px solid var(--color-line)',
      borderRadius: 4,
    }}>
      {envs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '5px 14px',
            background: active === id ? 'var(--color-surface)' : 'transparent',
            border: active === id ? '1px solid var(--color-line)' : '1px solid transparent',
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'Instrument Sans, system-ui, sans-serif',
            fontSize: 12, fontWeight: active === id ? 500 : 400,
            color: active === id ? 'var(--color-ink)' : 'var(--color-ink-tertiary)',
            transition: 'all 150ms ease-out',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Tier Labels (panel) ──────────────────────────────────────────────────────

function TierLabels() {
  const labels = [
    { tier: 0, x: TIER_X[0], label: 'Ingress' },
    { tier: 1, x: TIER_X[1], label: 'Core Services' },
    { tier: 2, x: TIER_X[2], label: 'Internal' },
    { tier: 3, x: TIER_X[3], label: 'Data & External' },
  ]

  return (
    <div style={{
      position: 'absolute', top: 12, left: 0, right: 0,
      pointerEvents: 'none', zIndex: 5,
      display: 'flex', gap: 0,
    }}>
      {labels.map(({ tier, x, label }) => (
        <div
          key={tier}
          style={{
            position: 'absolute',
            left: (x ?? 0) + 4,
            width: NODE_WIDTH,
            textAlign: 'center',
          }}
        >
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--color-ink-quaternary)',
          }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Observatory Graph ───────────────────────────────────────────────────

function ObservatoryGraph({
  selectedNodeId,
  onNodeSelect,
}: {
  selectedNodeId: string | null
  onNodeSelect: (id: string | null) => void
}) {
  const initialNodes = useMemo(() => computeLayout(), [])
  const initialEdges = useMemo(() => buildEdges(), [])

  const [nodes, , onNodesChange] = useNodesState<Node<ObsNodeData>>(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState<Edge<ObsEdgeData>>(initialEdges)

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.selectable === false) return
    onNodeSelect(node.id === selectedNodeId ? null : node.id)
  }, [selectedNodeId, onNodeSelect])

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  // Highlight selected node's edges
  const highlightedEdges = useMemo(() => {
    if (!selectedNodeId) return edges
    return edges.map((e) => ({
      ...e,
      style: {
        opacity: (e.source === selectedNodeId || e.target === selectedNodeId) ? 1 : 0.2,
      },
    }))
  }, [edges, selectedNodeId])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TierLabels />
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: n.id === selectedNodeId,
        }))}
        edges={highlightedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.12, includeHiddenNodes: false }}
        minZoom={0.35}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        panOnScroll
        selectionOnDrag={false}
        nodesDraggable={false}
      >
        <Background
          color="var(--color-line-subtle)"
          gap={24}
          size={0.5}
          style={{ opacity: 0.6 }}
        />
        <Controls
          position="bottom-left"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-line)',
            borderRadius: 4,
          }}
        />
        <Panel position="bottom-right">
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '6px 10px',
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-line)',
            borderRadius: 4,
          }}>
            {[
              { color: 'var(--color-signal-success)', label: 'Healthy' },
              { color: 'var(--color-signal-warning)', label: 'Degraded' },
              { color: 'var(--color-signal-danger)',  label: 'Incident' },
              { color: 'var(--color-signal-deploy)',  label: 'Rollout' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: 8,
                  color: 'var(--color-ink-tertiary)', letterSpacing: '0.06em',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

// ─── Page Root ────────────────────────────────────────────────────────────────

export function Observatory() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [env, setEnv] = useState<EnvFilter>('production')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const totalServices = OBS_NODES.filter(n => n.kind !== 'external').length
  const healthyCount = HEALTHY_NODES.filter(n => n.kind !== 'external').length
  const healthPct = Math.round((healthyCount / totalServices) * 100)

  const statItems: { label: string; value: string; colorClass?: string }[] = [
    { label: 'Services', value: String(totalServices) },
    { label: 'Active rollouts', value: String(ACTIVE_ROLLOUT_NODES.length), ...(ACTIVE_ROLLOUT_NODES.length > 0 ? { colorClass: 'text-signal-deploy' } : {}) },
    { label: 'Incidents', value: String(INCIDENT_NODES.filter(n => n.kind !== 'external').length), ...(INCIDENT_NODES.length > 0 ? { colorClass: 'text-signal-danger' } : {}) },
    { label: 'Health', value: `${healthPct}%`, colorClass: healthPct >= 95 ? 'text-signal-success' : healthPct >= 80 ? 'text-signal-warning' : 'text-signal-danger' },
  ]

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <DemoBanner />

      {/* ── Header chrome ── */}
      <div style={{
        padding: '16px 24px 14px',
        borderBottom: '1px solid var(--color-line)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Network size={14} style={{ color: 'var(--color-gold)' }} />
            <h1 style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 16, fontWeight: 500,
              color: 'var(--color-ink)',
              letterSpacing: '-0.018em', margin: 0,
            }}>
              Service Observatory
            </h1>
          </div>
          <StatStrip items={statItems} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 2 }}>
          <EnvFilter active={env} onChange={setEnv} />
          <ThemeToggle />
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Graph canvas */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            transition: 'flex 200ms ease-out',
          }}
        >
          {mounted && (
            <ReactFlowProvider>
              <ObservatoryGraph
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
            </ReactFlowProvider>
          )}
        </div>

        {/* Detail panel */}
        <div style={{
          width: 320,
          flexShrink: 0,
          borderLeft: '1px solid var(--color-line)',
          background: 'var(--color-surface-alt)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {selectedNodeId ? (
            <ServiceDetailPanel
              key={selectedNodeId}
              nodeId={selectedNodeId}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <SystemOverviewPanel />
          )}
        </div>
      </div>

      {/* Inline styles for ReactFlow overrides + animations */}
      <style>{`
        .obs-service-node:hover {
          border-color: color-mix(in oklch, var(--color-gold) 50%, transparent) !important;
        }

        /* ReactFlow internal overrides */
        .react-flow__node {
          cursor: default;
        }
        .react-flow__node[data-selectable="true"] {
          cursor: pointer;
        }
        .react-flow__controls {
          box-shadow: none !important;
        }
        .react-flow__controls-button {
          background: var(--color-surface-alt) !important;
          border-color: var(--color-line) !important;
          color: var(--color-ink-secondary) !important;
          fill: var(--color-ink-secondary) !important;
        }
        .react-flow__controls-button:hover {
          background: var(--color-surface) !important;
        }
        .react-flow__controls-button svg {
          fill: var(--color-ink-secondary);
        }
        .react-flow__minimap {
          display: none;
        }

        /* ReactFlow background dots adapt to theme */
        .react-flow__background {
          background-color: var(--color-surface) !important;
        }

        /* Animated dot on active rollout edges */
        @media (prefers-reduced-motion: no-preference) {
          .obs-split-bar-canary {
            animation: obs-canary-pulse 2s ease-in-out infinite;
          }
          @keyframes obs-canary-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.65; }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .obs-split-bar-canary {
            animation: none;
          }
        }

        .animate-fade-in {
          animation: obs-fade-in 200ms ease-out both;
        }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes obs-fade-in {
            from { opacity: 0; transform: translateX(8px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in { animation: none; }
        }
      `}</style>
    </div>
  )
}
