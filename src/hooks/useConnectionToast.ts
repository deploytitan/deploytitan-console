/**
 * useConnectionToast — fires debounced toast notifications on Zero connection
 * state changes.
 *
 * Rules:
 * - "Lost connection" and "Sync error" toasts are debounced: only fire if the
 *   bad state persists for DEBOUNCE_MS (2500ms). This suppresses flicker toasts
 *   when the connection bounces briefly during page transitions or token refresh.
 * - "Connection restored" fires immediately when returning to "connected" after
 *   a bad state (so the engineer gets clear confirmation things are working again).
 * - "connecting" state never emits a toast — it's too transient.
 * - Only one toast per state transition. A toastId is tracked so we can dismiss
 *   a pending error toast if the connection recovers before the debounce fires.
 *
 * Call this once in the console layout — it's a side-effect hook, no return value.
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useConnectionState } from './useConnectionState'

const DEBOUNCE_MS = 2_500

type BadStateName = 'disconnected' | 'error' | 'closed' | 'needs-auth'

const BAD_STATES = new Set<string>(['disconnected', 'error', 'closed', 'needs-auth'])

const MESSAGES: Record<BadStateName, { title: string; description?: string }> = {
  disconnected: {
    title: 'Lost connection to sync server',
    description: 'Data may be stale. Attempting to reconnect.',
  },
  error: {
    title: 'Sync error',
    description: 'Data may be stale. Check your network connection.',
  },
  closed: {
    title: 'Connection closed',
    description: 'Reload the page if this persists.',
  },
  'needs-auth': {
    title: 'Session expired',
    description: 'Refreshing your session...',
  },
}

export function useConnectionToast() {
  const state = useConnectionState()
  const prevStateRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeToastIdRef = useRef<string | number | null>(null)
  const hadBadStateRef = useRef(false)

  useEffect(() => {
    if (state === null) return

    const current = state.name
    const prev = prevStateRef.current

    // No change — nothing to do.
    if (current === prev) return

    prevStateRef.current = current

    // Clear any pending debounce timer on every state change.
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // ── Recovery ────────────────────────────────────────────────────────────
    if (current === 'connected') {
      // Dismiss any active error toast immediately.
      if (activeToastIdRef.current !== null) {
        toast.dismiss(activeToastIdRef.current)
        activeToastIdRef.current = null
      }

      // Only show "restored" if we actually came from a bad state that was
      // visible long enough to have fired a toast.
      if (hadBadStateRef.current) {
        toast.success('Connection restored', {
          description: 'Sync is live.',
          duration: 3_000,
        })
        hadBadStateRef.current = false
      }
      return
    }

    // ── Bad state — debounced ────────────────────────────────────────────────
    if (BAD_STATES.has(current)) {
      const msg = MESSAGES[current as BadStateName]

      debounceTimerRef.current = setTimeout(() => {
        hadBadStateRef.current = true

        const toastFn = current === 'needs-auth' ? toast.warning : toast.error
        const id = toastFn(msg.title, {
          description: msg.description,
          duration: Infinity, // stays until connection recovers or user dismisses
        })
        activeToastIdRef.current = id
      }, DEBOUNCE_MS)
    }
  }, [state])

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
    }
  }, [])
}
