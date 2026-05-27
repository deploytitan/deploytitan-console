'use client'

import { useEffect } from 'react'
import { useNavigate, useSearch } from '@/lib/navigation'

import { syncGitHubInstallation } from '@/lib/api'

type InstallState = {
  returnTo?: string | null
}

function decodeInstallState(state: string | undefined): InstallState {
  if (!state) return {}

  try {
    const base64 = state.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const json = atob(padded)
    const parsed = JSON.parse(json) as InstallState
    return {
      returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : null,
    }
  } catch {
    return {}
  }
}

function safeRedirectTarget(returnTo: string | null | undefined): string {
  if (!returnTo) return '/overview'

  try {
    const url = new URL(returnTo, window.location.origin)
    if (url.origin !== window.location.origin) return '/overview'
    return url.pathname + url.search + url.hash
  } catch {
    return '/overview'
  }
}

export function GitHubInstallCallback() {
  const search = useSearch() as Record<string, string | undefined>
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function finish() {
      const installationId = search.installation_id
      const { returnTo } = decodeInstallState(search.state)
      const target = safeRedirectTarget(returnTo)

      if (!installationId || search.setup_action === 'cancel') {
        navigate({ href: target, replace: true })
        return
      }

      try {
        await syncGitHubInstallation(installationId)
      } finally {
        if (!cancelled) navigate({ href: target, replace: true })
      }
    }

    void finish()

    return () => {
      cancelled = true
    }
  }, [navigate, search.installation_id, search.setup_action, search.state])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <span className="font-mono text-sm text-ink-tertiary">Completing GitHub installation...</span>
    </div>
  )
}
