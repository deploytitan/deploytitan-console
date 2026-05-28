'use client'

import { useTheme } from '@/hooks/useTheme'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type BrandLogoVariant = 'theme' | 'light-mode' | 'dark-mode'

interface BrandLogoProps {
  className?: string
  priority?: boolean
  variant?: BrandLogoVariant
}

const LIGHT_MODE_LOGO = '/light%20mode.svg'
const DARK_MODE_LOGO = '/dark%20mode.svg'

export function BrandLogo({
  className,
  priority = false,
  variant = 'theme',
}: BrandLogoProps) {
  const { resolved } = useTheme()
  const reducedMotion = useReducedMotion()

  const src =
    variant === 'light-mode'
      ? LIGHT_MODE_LOGO
      : variant === 'dark-mode'
        ? DARK_MODE_LOGO
        : resolved === 'dark'
          ? DARK_MODE_LOGO
          : LIGHT_MODE_LOGO

  const showLight = src === LIGHT_MODE_LOGO
  const transitionClass = reducedMotion ? '' : ' logo-theme-fade'

  return (
    <span
      className={`relative inline-block aspect-[2192/388] ${className ?? ''}`}
      aria-label="DeployTitan"
      role="img"
    >
      <img
        src={LIGHT_MODE_LOGO}
        alt=""
        aria-hidden="true"
        fetchPriority={priority ? 'high' : 'auto'}
        className={`absolute inset-0 h-full w-full ${transitionClass}`}
        style={{ opacity: showLight ? 1 : 0 }}
      />
      <img
        src={DARK_MODE_LOGO}
        alt=""
        aria-hidden="true"
        fetchPriority={priority ? 'high' : 'auto'}
        className={`absolute inset-0 h-full w-full ${transitionClass}`}
        style={{ opacity: showLight ? 0 : 1 }}
      />
    </span>
  )
}
