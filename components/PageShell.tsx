'use client'

import { Navigation } from '@/components/Navigation'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className = 'mx-auto max-w-lg p-4 md:max-w-3xl lg:max-w-5xl' }: PageShellProps) {
  return (
    <div className="min-h-screen pb-20">
      <div className={className}>{children}</div>
      <Navigation />
    </div>
  )
}
