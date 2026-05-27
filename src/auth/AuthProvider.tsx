'use client'

/**
 * AuthProvider — compatibility shim that wraps WorkOS AuthKit hooks.
 *
 * This module provides a unified auth interface used across the application,
 * built on top of WorkOS AuthKit's useAuth and refreshAuth.
 */

import { useAuth as useWorkosAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components'
import { signOut } from '@workos-inc/authkit-nextjs'

export interface AuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  profilePictureUrl: string | null
}

export interface SwitchOrgResult {
  error?: string
}

export interface UseAuthReturn {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | undefined
  organizationId: string | undefined
  login: (returnTo?: string) => void
  logout: () => Promise<void>
  switchToOrganization: (orgId: string) => Promise<SwitchOrgResult | void>
  /** @deprecated AuthKit handles token initialization via the callback route */
  initFromTokens: (tokens: Record<string, unknown>) => Promise<void>
}

/**
 * useAuth — application-level auth hook wrapping WorkOS AuthKit.
 *
 * Provides:
 * - user: current authenticated user or null
 * - isAuthenticated: whether user is logged in
 * - isLoading: whether auth state is loading
 * - login(returnTo): redirect to WorkOS sign-in
 * - logout(): sign out and redirect
 * - switchToOrganization(orgId): switch active org context
 * - initFromTokens: no-op (handled by AuthKit callback)
 */
export function useAuth(): UseAuthReturn {
  const {
    user: workosUser,
    loading,
    refreshAuth,
    organizationId,
    switchToOrganization: workosSwitchOrg,
  } = useWorkosAuth()
  const { accessToken } = useAccessToken()

  const user: AuthUser | null = workosUser
    ? {
        id: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName,
        lastName: workosUser.lastName,
        profilePictureUrl: workosUser.profilePictureUrl,
      }
    : null

  const isAuthenticated = !!workosUser
  const isLoading = loading

  const login = (returnTo?: string) => {
    // Use refreshAuth with ensureSignedIn to trigger the sign-in flow
    // This properly handles PKCE and state cookies
    void refreshAuth({ ensureSignedIn: true })
  }

  const logout = async () => {
    await signOut()
  }

  const switchToOrganization = async (orgId: string): Promise<SwitchOrgResult | void> => {
    // Use the WorkOS switchToOrganization method for proper org switching
    const result = await workosSwitchOrg(orgId)
    if (result && 'error' in result) {
      return { error: result.error }
    }
  }

  /**
   * @deprecated AuthKit handles token initialization via the callback route.
   * This is a no-op kept for API compatibility with legacy code.
   */
  const initFromTokens = async (_tokens: Record<string, unknown>) => {
    // AuthKit handles token initialization via the callback route
    // This is kept for API compatibility with legacy code
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    accessToken,
    organizationId,
    login,
    logout,
    switchToOrganization,
    initFromTokens,
  }
}
