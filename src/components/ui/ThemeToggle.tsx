'use client'

import { useTheme, type ThemeMode } from '../../hooks/useTheme'
import { cn } from '../../lib/utils'

const segments: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'System' },
  { mode: 'dark', label: 'Dark' },
]

function LightIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function DarkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

const iconMap: Record<ThemeMode, () => React.ReactElement> = {
  light: LightIcon,
  system: SystemIcon,
  dark: DarkIcon,
}

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme()

  return (
    <div
      className={cn(
        'flex items-center border border-line bg-surface-alt p-[2px] gap-[1px]',
        className,
      )}
      style={{ borderRadius: '2px' }}
      role="group"
      aria-label="Theme selector"
    >
      {segments.map((seg) => {
        const active = mode === seg.mode
        const Icon = iconMap[seg.mode]
        return (
          <button
            key={seg.mode}
            onClick={() => setMode(seg.mode)}
            aria-label={`${seg.label} theme`}
            aria-pressed={active}
            title={seg.label}
            className={cn(
              'flex items-center justify-center w-7 h-6 transition-all duration-200',
              active
                ? 'bg-surface text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-primary/20'
                : 'text-ink-quaternary hover:text-ink-secondary',
            )}
            style={{ borderRadius: '1px' }}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
