'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface AuthFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onSuccess?.()
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-6"
    >
      <div>
        <label className="block text-sm text-gray-400 mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50 transition-colors"
          placeholder="tu@email.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50 transition-colors"
          placeholder="••••••••"
          required
        />
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-neonMagenta text-sm"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-lg bg-neonCyan text-background font-semibold shadow-cyan hover:shadow-green disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
      >
        {loading ? 'Iniciando...' : 'Iniciar Sesión'}
      </motion.button>
    </motion.form>
  )
}

export function RegisterForm({ onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      onSuccess?.()
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="text-neonGreen text-4xl">✓</div>
        <h3 className="text-xl font-semibold">¡Registro exitoso!</h3>
        <p className="text-gray-400">Revisa tu email para confirmar tu cuenta</p>
      </motion.div>
    )
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-6"
    >
      <div>
        <label className="block text-sm text-gray-400 mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50 transition-colors"
          placeholder="tu@email.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50 transition-colors"
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          required
        />
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-neonMagenta text-sm"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-lg bg-neonCyan text-background font-semibold shadow-cyan hover:shadow-green disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
      >
        {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
      </motion.button>
    </motion.form>
  )
}