'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '◈' },
  { href: '/transactions', label: 'Movimientos', icon: '⇄' },
  { href: '/analysis', label: 'Análisis', icon: '≋' },
]

export function Navigation() {
  const pathname = usePathname()

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
      </div>
    </nav>
  )
}
