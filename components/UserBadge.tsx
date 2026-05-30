'use client'

import { useSupabase } from '@/components/SupabaseProvider'
import { createClient } from '@/lib/supabase/client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export function UserBadge() {
  const { user } = useSupabase()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [showMenu, setShowMenu] = useState(false)

  const email = user?.email || 'Sesión activa'
  const initial = email.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Cuenta</p>
        <p className="max-w-[220px] truncate text-sm text-gray-300">{email}</p>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neonCyan text-sm font-bold text-background shadow-cyan hover:bg-neonCyan/80 transition-all duration-200 focus:outline-none"
        >
          {initial}
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              {/* Overlay invisible para cerrar el menú al hacer click fuera */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur-xl z-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    handleSignOut()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-neonMagenta hover:bg-white/5 transition-colors focus:outline-none"
                >
                  <span className="text-base" aria-hidden="true">⟲</span>
                  <span>Cerrar sesión</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
