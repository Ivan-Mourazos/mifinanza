import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiFinanza',
  description: 'Gestión de finanzas personales',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}