/**
 * useBeforeUnloadGuard — shows the browser's native "leave page?" dialog
 * when there are pending Zero mutations that haven't been server-acknowledged.
 *
 * Place this hook once at a high-level layout component (e.g. ProtectedRouteLayout).
 * Modern browsers show a generic message regardless of the `returnValue` string,
 * but we set it anyway for older environments.
 */

import { useEffect } from 'react'
import { useHasPendingMutations } from '../store/pendingMutations'

export function useBeforeUnloadGuard() {
  const hasPending = useHasPendingMutations()

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    // Legacy support — Chrome < 119 and some other browsers read this.
    e.returnValue = 'Changes you made may not be saved.'
  }

  useEffect(() => {
    if (!hasPending) {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      return
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasPending])
}
