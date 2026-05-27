/**
 * pendingMutationsStore — tracks Zero mutations that have been applied
 * optimistically on the client but not yet acknowledged by the server.
 *
 * Usage:
 *   - Call `registerPendingMutation(write.server)` after firing a Zero mutation.
 *   - Read `useHasPendingMutations()` anywhere to check if syncing is in-flight.
 */

import { create } from 'zustand'

interface PendingMutationsStore {
  pendingCount: number
  registerPendingMutation: (serverPromise: Promise<unknown>) => void
}

export const usePendingMutationsStore = create<PendingMutationsStore>((set, get) => ({
  pendingCount: 0,
  registerPendingMutation(serverPromise: Promise<unknown>) {
    set((s) => ({ pendingCount: s.pendingCount + 1 }))

    const decrement = () =>
      set((s) => ({ pendingCount: Math.max(0, s.pendingCount - 1) }))

    serverPromise.then(decrement, decrement)
  },
}))

export function useHasPendingMutations(): boolean {
  return usePendingMutationsStore((s) => s.pendingCount > 0)
}

/** Call this to register a Zero server-ack promise outside of React. */
export function registerPendingMutation(serverPromise: Promise<unknown>) {
  usePendingMutationsStore.getState().registerPendingMutation(serverPromise)
}
