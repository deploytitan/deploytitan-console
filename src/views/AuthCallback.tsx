'use client'

/**
 * AuthCallback — handles the WorkOS OAuth redirect and exchanges the
 * authorization code for tokens via the DeployTitan API.
 *
 * WorkOS redirects to WORKOS_REDIRECT_URI (e.g. http://localhost:8080/auth/callback)
 * with ?code=... and optionally ?state=... which may encode returnPathname.
 *
 * This component:
 *  1. Reads `code` from the URL search params.
 *  2. POSTs to /auth/callback on the API to exchange the code for tokens.
 *  3. Calls initFromTokens() to store tokens and populate auth state.
 *  4. Navigates to returnPathname (decoded from state) or /overview.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@/lib/navigation'
import { useAuth } from '../auth/AuthProvider'
import { apiRequest } from '../lib/api'

interface CallbackSearchParams {
  code?: string
  state?: string
  error?: string
  error_description?: string
}

interface CallbackResponse {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    profilePictureUrl: string | null
    identityOrganizationId: string | null
  }
  accessToken: string
  expiresAt: string
  refreshToken: string
}

function decodeReturnPathname(state: string | undefined): string {
  if (!state) return '/overview'
  try {
    const parsed = JSON.parse(atob(state)) as { returnPathname?: string }
    return parsed.returnPathname ?? '/overview'
  } catch {
    // state may just be a raw returnPathname string from some flows
    return state.startsWith('/') ? state : '/overview'
  }
}

export function AuthCallback() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as CallbackSearchParams
  const { initFromTokens } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const didExchange = useRef(false)

  useEffect(() => {
    // Guard against React Strict Mode double-fire
    if (didExchange.current) return
    didExchange.current = true

    const { code, state, error: oauthError, error_description } = search

    if (oauthError) {
      setError(error_description ?? oauthError)
      return
    }

    if (!code) {
      setError('No authorization code received from WorkOS.')
      return
    }

    apiRequest<CallbackResponse>('/auth/callback', {
      method: 'POST',
      json: { code },
      skipAuth: true,
    })
      .then((result) => {
        initFromTokens({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        })
        const returnTo = decodeReturnPathname(state)
        void navigate({ to: returnTo, replace: true })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <p className="font-mono text-sm text-red-500">Sign-in failed</p>
          <p className="font-mono text-xs text-ink-tertiary">{error}</p>
          <a
            href="/"
            className="inline-block mt-4 text-xs font-mono text-ink-tertiary hover:text-ink underline"
          >
            Return to home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-4">
        <div
          className="w-8 h-8 border-2 border-gold border-t-transparent mx-auto animate-spin"
          style={{ borderRadius: '50%' }}
        />
        <p className="font-mono text-sm text-ink-tertiary">Completing sign in...</p>
      </div>
    </div>
  )
}
