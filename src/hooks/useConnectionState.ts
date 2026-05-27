/**
 * useConnectionState — safe wrapper around @rocicorp/zero's useConnectionState.
 *
 * Returns null when:
 * - SSR (no window)
 * - Zero is not yet in context (unauthenticated or pre-mount)
 *
 * This lets consumers unconditionally call the hook without crashing on
 * routes where Zero hasn't initialised yet.
 */

import { useConnectionState as useZeroConnectionState } from '@rocicorp/zero/react'
import type { ConnectionState } from '@rocicorp/zero'

export type { ConnectionState }

/**
 * Returns the current Zero connection state, or null if Zero is not available.
 * Safe to call anywhere in the tree.
 */
export function useConnectionState(): ConnectionState | null {
  try {
    return useZeroConnectionState()
  } catch {
    // ZeroContext is not available (SSR, unauthenticated, or pre-mount).
    return null
  }
}
