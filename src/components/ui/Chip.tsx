'use client'

import { cn } from '../../lib/utils'
import { StatusDot } from './StatusDot'

interface ChipProps {
  label: string
  status?: 'success' | 'warning' | 'danger' | 'deploy' | 'neutral'
  className?: string
}

export function Chip({ label, status, className }: ChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1.5 border border-line-subtle text-[10px] font-mono text-ink-secondary hover:border-gold/20 hover:bg-gold-muted transition-all',
        className,
      )}
      style={{ borderRadius: '2px' }}
    >
      {status && <StatusDot status={status} />}
      {label}
    </div>
  )
}
