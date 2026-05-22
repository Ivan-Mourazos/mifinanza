'use client'

import { useSupabase } from '@/components/SupabaseProvider'

export function UserBadge() {
  const { user } = useSupabase()
  const email = user?.email || 'Sesión activa'
  const initial = email.charAt(0).toUpperCase()

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Cuenta</p>
        <p className="max-w-[220px] truncate text-sm text-gray-300">{email}</p>
      </div>
      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-neonCyan text-sm font-bold text-background shadow-cyan"
      >
        {initial}
      </div>
    </div>
  )
}
