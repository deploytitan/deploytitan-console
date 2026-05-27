'use client'

const colorMap = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  deploy: '#3b82f6',
  gold: '#c9a84c',
  neutral: '#b5aea6',
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
        boxShadow: glow ? `0 0 6px ${color}40` : undefined,
        animation: pulse ? 'pulse-anim 1.5s infinite' : undefined,
      }}
    />
  )
}
