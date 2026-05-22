'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function enterApp() {
      setError(null)

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
        })
        const result = await response.json()

        if (!response.ok || !result.session) {
          if (!cancelled) setError(result.error || 'No se pudo entrar.')
          return
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })

        if (sessionError) {
          if (!cancelled) setError(sessionError.message)
          return
        }

        window.location.assign('/dashboard')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo entrar.')
        }
      }
    }

    enterApp()

    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-4xl font-bold text-neonGreen">MiFinanza</h1>
        <div className="glass rounded-2xl p-6">
          {error ? (
            <>
              <p className="text-sm text-neonMagenta">{error}</p>
              <p className="mt-3 text-xs text-gray-500">
                Ejecuta bun run create-user y recarga esta página.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neonCyan border-t-transparent" />
              <p className="mt-4 text-sm text-gray-400">Entrando...</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
