'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  loading?: boolean
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  loading = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    cancelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onCancel, open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            if (!loading) onCancel()
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 8 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            className="glass w-full max-w-sm rounded-2xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm text-gray-400">
              {description}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 rounded-lg bg-white/10 py-3 font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 rounded-lg py-3 font-semibold focus:outline-none focus-visible:ring-2 disabled:opacity-50 ${
                  destructive
                    ? 'bg-neonMagenta text-white focus-visible:ring-neonMagenta'
                    : 'bg-neonCyan text-background focus-visible:ring-neonCyan'
                }`}
              >
                {loading ? 'Procesando...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
