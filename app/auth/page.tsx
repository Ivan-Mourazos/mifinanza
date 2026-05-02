'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        router.replace('/dashboard')
      }
    })
  }, [router, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMsg(null)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMsg('Revisa tu email para confirmar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-neonGreen text-center mb-2">MiFinanza</h1>
        <p className="text-gray-400 text-center mb-8">Tus finanzas, simple</p>

        <div className="glass rounded-2xl p-6">
          <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${
                mode === 'login' ? 'bg-neonCyan text-background' : 'text-gray-400'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${
                mode === 'register' ? 'bg-neonCyan text-background' : 'text-gray-400'
              }`}
            >
              Registro
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm text-gray-300">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm text-gray-300">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan"
                  required
                />
              </div>
              {error && <p className="text-neonMagenta text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-neonCyan text-background font-semibold disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="register-email" className="mb-2 block text-sm text-gray-300">
                  Email
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-password" className="mb-2 block text-sm text-gray-300">
                  Contraseña
                </label>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan"
                  required
                />
              </div>
              {error && <p className="text-neonMagenta text-sm">{error}</p>}
              {msg && <p className="text-neonGreen text-sm">{msg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-neonCyan text-background font-semibold disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Registrarse'}
              </button>
            </form>
          )}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-gray-500">
          <p>Usa un email válido y una contraseña segura.</p>
          <p className="mt-2">
            Tus movimientos se guardan en tu cuenta y cada usuario solo puede ver sus propios datos.
          </p>
        </div>
      </div>
    </div>
  )
}