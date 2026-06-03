'use client'

/**
 * ProgressBar — convenience wrapper around the shadcn Progress primitive.
 *
 * Simpler API for single-value inline progress bars.
 * For full control (label, value readout), use Progress/ProgressTrack/ProgressIndicator
 * from '@/components/ui/progress' directly.
 */
import { ProgressTrack, ProgressIndicator } from '@/components/ui/progress'

interface ProgressBarProps {
  value: number // 0–100
  className?: string
  color?: string
}

export function ProgressBar({ value, className, color = 'var(--color-primary)' }: ProgressBarProps) {
  return (
    <ProgressTrack className={className}>
      <ProgressIndicator
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color, borderRadius: '1px' }}
      />
    </ProgressTrack>
  )
}
