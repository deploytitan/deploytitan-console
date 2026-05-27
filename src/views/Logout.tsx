'use client'

import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function Logout() {
  const { logout } = useAuth()

  useEffect(() => {
    void logout()
  }, [logout])

  return (
    <main className="min-h-screen grid place-items-center bg-surface text-ink">
      <div className="text-center space-y-2">
        <div className="mx-auto h-4 w-4 rounded-full border border-current border-t-transparent animate-spin" aria-hidden="true" />
        <p className="text-sm text-ink-secondary">Signing out...</p>
      </div>
    </main>
  )
}
