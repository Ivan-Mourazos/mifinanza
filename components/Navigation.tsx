'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '◈' },
  { href: '/transactions', label: 'Movimientos', icon: '⇄' },
  { href: '/analysis', label: 'Análisis', icon: '≋' },
  { href: '/categories', label: 'Categorías', icon: '⊕' },
]

export function Navigation() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className="flex-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neonCyan"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-1 py-2 px-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? 'text-neonCyan'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span aria-hidden="true" className="text-xl">{item.icon}</span>
              <span className="text-[11px]">{item.label}</span>
            </motion.div>
          </Link>
        ))}

        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Cerrar sesión"
            className="flex flex-col items-center gap-1 py-2 px-2 rounded-lg text-gray-500 hover:text-neonMagenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neonMagenta"
          >
            <span aria-hidden="true" className="text-xl">⟲</span>
            <span className="text-[11px]">Salir</span>
          </button>
        )}
      </div>
    </nav>
  )
}