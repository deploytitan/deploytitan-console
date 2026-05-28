/**
 * Tracks in-flight Zero server mutations so the beforeunload guard can warn
 * the user if they try to close the tab before a mutation is confirmed.
 */

const pending = new Set<Promise<unknown>>();

export function registerPendingMutation(serverAck: Promise<unknown>): void {
  pending.add(serverAck);
  serverAck.finally(() => pending.delete(serverAck));
}

export function hasPendingMutations(): boolean {
  return pending.size > 0;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (pending.size > 0) {
      e.preventDefault();
    }
  });
}
