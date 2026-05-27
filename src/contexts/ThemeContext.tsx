'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'dt-theme'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme()
  return mode
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with 'light' so first render is consistent before localStorage is read.
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [mounted, setMounted] = useState(false)

  // After mount: read the real stored/system preference and sync the DOM once.
  useEffect(() => {
    let stored: ThemeMode | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw
    } catch {
      // ignore
    }
    const real: ThemeMode = stored ?? 'system'
    setModeState(real)
    applyTheme(resolveTheme(real))
    setMounted(true)
  }, [])

  // Keep the DOM in sync whenever mode changes after mount.
  useEffect(() => {
    if (!mounted) return
    applyTheme(resolveTheme(mode))
  }, [mode, mounted])

  // Listen for OS preference changes when mode is 'system'.
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(resolveTheme('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
    applyTheme(resolveTheme(next))
  }

  const resolved: ResolvedTheme = mounted ? resolveTheme(mode) : 'light'

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
