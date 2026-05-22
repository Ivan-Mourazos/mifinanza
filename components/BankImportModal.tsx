'use client'

import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SupabaseClient } from '@supabase/supabase-js'
import { Category } from '@/lib/types'
import { formatCurrency } from '@/lib/finance'

interface BankImportModalProps {
  open: boolean
  onClose: () => void
  onImportComplete: () => Promise<void>
  categories: Category[]
  supabase: SupabaseClient
  userId: string
}

interface ParsedMovement {
  tempId: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  categoryId: string
  selected: boolean
}

export function BankImportModal({
  open,
  onClose,
  onImportComplete,
  categories,
  supabase,
  userId,
}: BankImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedMovements, setParsedMovements] = useState<ParsedMovement[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFile(null)
    setParsedMovements([])
    setError(null)
  }

  const handleClose = () => {
    if (importing) return
    resetState()
    onClose()
  }

  // Parse decimal amount with comma/period detection (Spanish format support)
  const parseSpanishAmount = (amountStr: string): number => {
    let clean = amountStr.replace(/[^\d,\.-]/g, '')
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(/,/g, '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(/,/g, '.')
    }
    return parseFloat(clean)
  }

  // Keywords auto-categorization
  const guessCategory = (description: string, type: 'income' | 'expense'): string => {
    const desc = description.toLowerCase()

    const ruleMatches: { [key: string]: string[] } = {
      Salario: ['nomina', 'salario', 'sueldo', 'bbva pension', 'pension', 'finiquito', 'transferencia recibida'],
      Freelance: ['freelance', 'factura', 'abono factura', 'honorarios'],
      Comida: [
        'mercadona',
        'carrefour',
        'lidl',
        'alcampo',
        'dia',
        'ahorramas',
        'supermercado',
        'consum',
        'eroski',
        'aldi',
        'hipercor',
        'restaurante',
        'bar ',
        'telepizza',
        'mcdonald',
        'burger king',
        'uber eats',
        'just eat',
        'glovo',
        'pans ',
        'vips',
      ],
      Transporte: [
        'repsol',
        'cepsa',
        'bp',
        'galp',
        'shell',
        'gasolinera',
        'peaje',
        'renfe',
        'uber',
        'cabify',
        'metro',
        'emt ',
        'estacionamiento',
        'aparcamiento',
        'taxis',
        'alvia',
        'ave ',
      ],
      Servicios: [
        'iberdrola',
        'endesa',
        'naturgy',
        'movistar',
        'vodafone',
        'orange',
        'digi',
        'luz',
        'agua',
        'gas natural',
        'comunidad',
        'seguro',
        'renta',
        'alquiler',
        'recibo',
        'gas ',
      ],
      Entretenimiento: [
        'netflix',
        'spotify',
        'amazon prime',
        'hbo',
        'disney',
        'steam',
        'playstation',
        'nintendo',
        'cine',
        'entradas',
        'teatro',
        'concierto',
        'youtube premium',
      ],
    }

    const findCategoryByName = (name: string) => {
      return categories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type)?.id
    }

    for (const [catName, keywords] of Object.entries(ruleMatches)) {
      if (keywords.some((keyword) => desc.includes(keyword))) {
        const catId = findCategoryByName(catName)
        if (catId) return catId
      }
    }

    const defaultExpenseId =
      categories.find((c) => c.type === 'expense' && c.name.toLowerCase().includes('otros'))?.id ||
      categories.find((c) => c.type === 'expense')?.id ||
      ''
    const defaultIncomeId =
      categories.find((c) => c.type === 'income' && c.name.toLowerCase().includes('otro'))?.id ||
      categories.find((c) => c.type === 'income')?.id ||
      ''

    return type === 'income' ? defaultIncomeId : defaultExpenseId
  }

  // Parse CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    processFile(selectedFile)
  }

  const processFile = (selectedFile: File) => {
    setFile(selectedFile)
    setParsing(true)
    setError(null)

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        if (!text) {
          throw new Error('El archivo está vacío.')
        }

        // Split lines and clean empty ones
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

        // Helper to normalize strings for header comparison
        const norm = (s: string) =>
          s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()

        let delimiter = ';'
        let headerIndex = -1
        let dateIdx = -1
        let descIdx = -1
        let amountIdx = -1

        // Scan lines to find header row by identifying keywords
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
          const line = lines[i]
          // Detect separator
          const semicolons = (line.match(/;/g) || []).length
          const commas = (line.match(/,/g) || []).length
          const currentDelimiter = semicolons >= commas ? ';' : ','

          const cells = line.split(currentDelimiter).map((c) => norm(c.replace(/^"|"$/g, '')))

          const hasFecha = cells.some((c) => c.includes('fecha'))
          const hasConcepto = cells.some((c) => c.includes('concepto') || c.includes('descripcion') || c.includes('detalle'))
          const hasImporte = cells.some(
            (c) =>
              c.includes('importe') ||
              c.includes('cantidad') ||
              c.includes('valor') ||
              c.includes('movimiento') ||
              c.includes('cargo') ||
              c.includes('abono')
          )

          if (hasFecha && (hasConcepto || hasImporte)) {
            delimiter = currentDelimiter
            headerIndex = i
            dateIdx = cells.findIndex((c) => c.includes('fecha'))
            descIdx = cells.findIndex((c) => c.includes('concepto') || c.includes('descripcion') || c.includes('detalle'))
            amountIdx = cells.findIndex(
              (c) =>
                c.includes('importe') ||
                c.includes('cantidad') ||
                c.includes('valor') ||
                c.includes('movimiento') ||
                c.includes('cargo') ||
                c.includes('abono')
            )
            break
          }
        }

        // Fallback defaults if headers not matched
        if (headerIndex === -1) {
          // Guess it's a standard table starting at line 0, delimited by semicolon
          // Typically BBVA exports operates with Date in column 0, Description in 2, Amount in 3
          delimiter = text.includes(';') ? ';' : ','
          headerIndex = 0
          dateIdx = 0
          descIdx = 2
          amountIdx = 3
        }

        const movements: ParsedMovement[] = []

        // Parse remaining lines as movements
        for (let i = headerIndex + 1; i < lines.length; i++) {
          const line = lines[i]
          const cells = line.split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim())

          // Skip rows without enough columns or invalid date cell
          if (cells.length <= Math.max(dateIdx, descIdx, amountIdx) || !cells[dateIdx]) {
            continue
          }

          const rawDate = cells[dateIdx]
          const description = cells[descIdx] || 'Movimiento bancario'
          const rawAmount = cells[amountIdx]

          const parsedAmount = parseSpanishAmount(rawAmount)
          if (isNaN(parsedAmount) || parsedAmount === 0) continue

          // Convert Date from DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
          let finalDate = ''
          const dateMatch = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0')
            const month = dateMatch[2].padStart(2, '0')
            const year = dateMatch[3]
            finalDate = `${year}-${month}-${day}`
          } else {
            // Try ISO format
            const isoMatch = rawDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
            if (isoMatch) {
              const year = isoMatch[1]
              const month = isoMatch[2].padStart(2, '0')
              const day = isoMatch[3].padStart(2, '0')
              finalDate = `${year}-${month}-${day}`
            } else {
              // Skip if invalid date
              continue
            }
          }

          const type = parsedAmount > 0 ? 'income' : 'expense'
          const finalAmount = Math.abs(parsedAmount)
          const categoryId = guessCategory(description, type)

          movements.push({
            tempId: `tmp_${i}_${Date.now()}`,
            date: finalDate,
            description,
            amount: finalAmount,
            type,
            categoryId,
            selected: true,
          })
        }

        if (movements.length === 0) {
          throw new Error('No se detectaron movimientos válidos en el archivo. Verifica el formato.')
        }

        setParsedMovements(movements)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al analizar el archivo.')
        setFile(null)
      } finally {
        setParsing(false)
      }
    }

    reader.onerror = () => {
      setError('Error al leer el archivo.')
      setFile(null)
      setParsing(false)
    }

    // Try reading with ISO-8859-1 for Spanish letters support, falls back to UTF-8
    reader.readAsText(selectedFile, 'ISO-8859-1')
  }

  // Toggle selection
  const handleToggleRow = (tempId: string) => {
    setParsedMovements((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, selected: !m.selected } : m))
    )
  }

  // Change category of single parsed movement
  const handleCategoryChange = (tempId: string, categoryId: string) => {
    setParsedMovements((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, categoryId } : m))
    )
  }

  // Select all or deselect all toggle
  const allSelected = useMemo(() => {
    return parsedMovements.length > 0 && parsedMovements.every((m) => m.selected)
  }, [parsedMovements])

  const handleToggleAll = () => {
    setParsedMovements((prev) => prev.map((m) => ({ ...m, selected: !allSelected })))
  }

  const selectedCount = useMemo(() => {
    return parsedMovements.filter((m) => m.selected).length
  }, [parsedMovements])

  // Save selected to Supabase
  const handleImport = async () => {
    const selectedMovements = parsedMovements.filter((m) => m.selected)
    if (selectedMovements.length === 0) return

    setImporting(true)
    setError(null)

    const insertData = selectedMovements.map((m) => ({
      user_id: userId,
      amount: m.amount,
      date: m.date,
      description: m.description,
      category_id: m.categoryId,
      type: m.type,
    }))

    try {
      const { error: insertError } = await supabase.from('transactions').insert(insertData)
      if (insertError) {
        throw new Error(insertError.message || 'No se pudieron guardar los movimientos.')
      }

      await onImportComplete()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar los movimientos en la base de datos.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            role="dialog"
            aria-modal="true"
            className="glass w-full max-w-2xl rounded-2xl p-6 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="text-xl font-bold text-white">Importar Extracto Bancario</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={importing}
                className="text-gray-500 hover:text-white text-lg p-1 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-neonMagenta/10 border border-neonMagenta/20 p-3 text-sm text-neonMagenta">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
              {parsedMovements.length === 0 ? (
                // Drag & Drop Area
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const droppedFile = e.dataTransfer.files?.[0]
                    if (droppedFile) processFile(droppedFile)
                  }}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-10 cursor-pointer hover:border-neonCyan/50 hover:bg-white/[0.01] transition-all group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.txt"
                    className="hidden"
                  />
                  <span className="text-4xl mb-3 text-gray-600 group-hover:text-neonCyan transition-colors">⤓</span>
                  <p className="text-sm font-semibold text-white">Arrastra el archivo CSV de tu banco aquí</p>
                  <p className="text-xs text-gray-500 mt-1">O haz clic para explorar tus archivos (.csv, .txt)</p>
                  <div className="mt-4 rounded bg-white/5 px-2.5 py-1.5 text-xs text-gray-400 max-w-xs text-center">
                    Optimizado para extractos de BBVA y banca móvil española.
                  </div>
                </div>
              ) : (
                // Interactive Preview List
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 px-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleAll}
                        className="rounded border-white/10 bg-surface text-neonCyan focus:ring-0 cursor-pointer"
                      />
                      <span>Seleccionar todos ({parsedMovements.length})</span>
                    </label>
                    <span>Importando {selectedCount} de {parsedMovements.length}</span>
                  </div>

                  <div className="space-y-2 border border-white/5 rounded-xl bg-white/[0.02] p-2 divide-y divide-white/5 max-h-[45vh] overflow-y-auto">
                    {parsedMovements.map((movement) => (
                      <div
                        key={movement.tempId}
                        className={`flex items-center gap-3 py-3 px-2 transition-colors ${
                          movement.selected ? 'bg-white/[0.01]' : 'opacity-40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={movement.selected}
                          onChange={() => handleToggleRow(movement.tempId)}
                          className="rounded border-white/10 bg-surface text-neonCyan focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate font-medium">{movement.description}</p>
                          <p className="text-xs text-gray-500">{movement.date}</p>
                        </div>
                        <div className="w-36">
                          <select
                            value={movement.categoryId}
                            onChange={(e) => handleCategoryChange(movement.tempId, e.target.value)}
                            disabled={!movement.selected}
                            className="w-full text-xs rounded border border-white/10 bg-surface px-2 py-1 text-gray-300 focus:outline-none focus:border-neonCyan/50 disabled:opacity-50"
                          >
                            <option value="">Seleccionar categoría</option>
                            {categories
                              .filter((c) => c.type === movement.type)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <p
                          className={`text-sm font-semibold w-24 text-right shrink-0 ${
                            movement.type === 'income' ? 'text-neonGreen' : 'text-neonMagenta'
                          }`}
                        >
                          {movement.type === 'income' ? '+' : '-'}
                          {formatCurrency(movement.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-4">
              {parsedMovements.length > 0 ? (
                <button
                  type="button"
                  onClick={resetState}
                  disabled={importing}
                  className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Cambiar archivo
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={importing}
                  className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                {parsedMovements.length > 0 && (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0}
                    className="rounded-lg bg-neonCyan px-5 py-2.5 text-sm font-semibold text-background shadow-cyan disabled:opacity-50"
                  >
                    {importing ? 'Guardando...' : `Importar ${selectedCount} Movimientos`}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
