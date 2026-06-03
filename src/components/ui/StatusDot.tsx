'use client'

const colorMap = {
  success: 'var(--color-signal-success)',
  warning: 'var(--color-signal-warning)',
  danger: 'var(--color-signal-danger)',
  deploy: 'var(--color-signal-deploy)',
  gold: 'var(--color-primary)',
  neutral: 'var(--color-ink-quaternary)',
}

interface StatusDotProps {
  status: keyof typeof colorMap
  pulse?: boolean
  glow?: boolean
  size?: 'sm' | 'md'
}

export function StatusDot({ status, pulse, glow, size = 'sm' }: StatusDotProps) {
  const color = colorMap[status]
  const dim = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
  return (
    <span
      className={`${dim} inline-block flex-shrink-0 transition-all duration-300`}
      style={{
        borderRadius: '0.5px',
        backgroundColor: color,
        boxShadow: glow
          ? `0 0 6px color-mix(in srgb, ${color} 25%, transparent)`
          : undefined,
        animation: pulse ? 'pulse-anim 1.5s infinite' : undefined,
      }}
    />
  )
}
