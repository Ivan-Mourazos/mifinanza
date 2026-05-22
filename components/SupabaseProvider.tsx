'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type SupabaseContextType = {
  user: User | null
  session: Session | null
  loading: boolean
}

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  session: null,
  loading: true,
})

export function useSupabase() {
  return useContext(SupabaseContext)
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <SupabaseContext.Provider value={{ user, session, loading }}>
      {children}
    </SupabaseContext.Provider>
  )
}
