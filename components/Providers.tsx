'use client'

import { SupabaseProvider } from '@/components/SupabaseProvider'
import { FinanceProvider } from '@/context/FinanceContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </SupabaseProvider>
  )
}
