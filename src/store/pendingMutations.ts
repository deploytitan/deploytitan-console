/**
 * Tracks in-flight Zero server mutations so the beforeunload guard can warn
 * the user if they try to close the tab before a mutation is confirmed, and
 * so the sync badge can distinguish local sync from server-confirmed writes.
 */

import { useSyncExternalStore } from "react";

const pending = new Set<Promise<unknown>>();
let failedCount = 0;
const listeners = new Set<() => void>();
let snapshot: PendingMutationSnapshot = { pendingCount: 0, failedCount: 0 };

export interface PendingMutationSnapshot {
  pendingCount: number;
  failedCount: number;
}

function getSnapshot(): PendingMutationSnapshot {
  return snapshot;
}

function notify(): void {
  snapshot = { pendingCount: pending.size, failedCount };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerPendingMutation(serverAck: Promise<unknown>): void {
  pending.add(serverAck);
  notify();
  serverAck
    .then(() => {
      failedCount = 0;
    })
    .catch(() => {
      failedCount += 1;
    })
    .finally(() => {
      pending.delete(serverAck);
      notify();
    });
}

export function hasPendingMutations(): boolean {
  return pending.size > 0;
}

export function usePendingMutations(): PendingMutationSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (pending.size > 0) {
      e.preventDefault();
    }
  });
}
