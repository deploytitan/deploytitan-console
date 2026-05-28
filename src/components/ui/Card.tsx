'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { useSpotlight } from '../../hooks/useSpotlight'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className, onClick }: CardProps) {
  const { onMouseMove } = useSpotlight()
  return (
    <div
      className={cn(
        'relative border border-line bg-surface p-6 group transition-all duration-300',
        'hover:border-gold/30 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(201,168,76,0.08)]',
        'spotlight-card overflow-hidden',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{ borderRadius: '4px' }}
      onClick={onClick}
      onMouseMove={onMouseMove}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-gold/0 group-hover:border-gold/30 transition-all duration-300" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-gold/0 group-hover:border-gold/30 transition-all duration-300" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
