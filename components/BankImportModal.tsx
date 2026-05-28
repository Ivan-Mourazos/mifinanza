'use client'

import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SupabaseClient } from '@supabase/supabase-js'
import { Category } from '@/lib/types'
import { formatCurrency } from '@/lib/finance'
import {
  guessOptimizedCategoryName,
  transactionDuplicateKey,
} from '@/lib/finance'
import { saveCategory } from '@/lib/finance-mutations'

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
  original_description: string
  amount: number
  type: 'income' | 'expense'
  categoryId: string
  selected: boolean
}

type RawTable = Array<Array<string | number | boolean | Date | null | undefined>>
type TransactionType = 'income' | 'expense'

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

  // Inline category creation in import modal
  const [creatingCategoryRow, setCreatingCategoryRow] = useState<ParsedMovement | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#22C55E')
  const [creatingCat, setCreatingCat] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)

  const resetState = () => {
    setFile(null)
    setParsedMovements([])
    setError(null)
    setCreatingCategoryRow(null)
    setNewCatName('')
    setNewCatColor('#22C55E')
    setCatError(null)
  }

  const handleClose = () => {
    if (importing) return
    resetState()
    onClose()
  }

  const normalizeText = (value: unknown) =>
    String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const stringifyCell = (value: unknown) => {
    if (value instanceof Date) {
      return value.toISOString()
    }

    return String(value ?? '').trim()
  }

  const parseSpanishAmount = (value: unknown): number => {
    if (typeof value === 'number') {
      return value
    }

    let clean = stringifyCell(value).replace(/[^\d,\.-]/g, '')
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(/,/g, '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(/,/g, '.')
    }
    return parseFloat(clean)
  }

  const excelSerialToDate = (serial: number) => {
    const utcDays = Math.floor(serial - 25569)
    const utcValue = utcDays * 86400
    return new Date(utcValue * 1000)
  }

  const formatDate = (dateValue: unknown): string | null => {
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return dateValue.toISOString().slice(0, 10)
    }

    if (typeof dateValue === 'number' && Number.isFinite(dateValue)) {
      return excelSerialToDate(dateValue).toISOString().slice(0, 10)
    }

    const rawDate = stringifyCell(dateValue)
    const dateMatch = rawDate.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0')
      const month = dateMatch[2].padStart(2, '0')
      const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]
      return `${year}-${month}-${day}`
    }

    const isoMatch = rawDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (isoMatch) {
      const year = isoMatch[1]
      const month = isoMatch[2].padStart(2, '0')
      const day = isoMatch[3].padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return null
  }

  const guessCategory = (description: string, type: TransactionType): string => {
    const categoryName = guessOptimizedCategoryName(description, type)
    const optimizedCategoryId = categories.find(
      (category) => category.name.toLowerCase() === categoryName.toLowerCase() && category.type === type
    )?.id

    if (optimizedCategoryId) return optimizedCategoryId

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    processFile(selectedFile)
  }

  const splitCsvLine = (line: string, delimiter: string) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const next = line[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    cells.push(current.trim())
    return cells
  }

  const parseRows = (rows: RawTable): ParsedMovement[] => {
    const normalizedRows = rows
      .map((row) => Array.from({ length: row.length }, (_, index) => stringifyCell(row[index])))
      .filter((row) => row.some(Boolean))

    let headerIndex = -1
    let dateIdx = -1
    let descIdx = -1
    let movementIdx = -1
    let observationsIdx = -1
    let amountIdx = -1
    let debitIdx = -1
    let creditIdx = -1

    for (let i = 0; i < Math.min(normalizedRows.length, 30); i++) {
      const cells = normalizedRows[i].map(normalizeText)
      const foundDateIdx = cells.findIndex((cell) => cell === 'fecha' || cell.includes('fecha operacion'))
      const foundDescIdx = cells.findIndex(
        (cell) =>
          cell === 'concepto' ||
          cell.includes('descripcion') ||
          cell.includes('detalle') ||
          cell.includes('operacion')
      )
      const foundMovementIdx = cells.findIndex((cell) => cell === 'movimiento')
      const foundObservationsIdx = cells.findIndex((cell) => cell.includes('observaciones'))
      const foundAmountIdx = cells.findIndex(
        (cell) =>
          cell === 'importe' ||
          cell.includes('importe') ||
          cell.includes('cantidad') ||
          cell.includes('saldo movimiento')
      )
      const foundDebitIdx = cells.findIndex(
        (cell) => cell.includes('cargo') || cell.includes('debe') || cell.includes('debito')
      )
      const foundCreditIdx = cells.findIndex(
        (cell) => cell.includes('abono') || cell.includes('haber') || cell.includes('credito')
      )

      if (foundDateIdx >= 0 && (foundAmountIdx >= 0 || foundDebitIdx >= 0 || foundCreditIdx >= 0)) {
        headerIndex = i
        dateIdx = foundDateIdx
        descIdx = foundDescIdx >= 0 ? foundDescIdx : foundMovementIdx >= 0 ? foundMovementIdx : cells.findIndex(Boolean)
        movementIdx = foundMovementIdx
        observationsIdx = foundObservationsIdx
        amountIdx = foundAmountIdx
        debitIdx = foundDebitIdx
        creditIdx = foundCreditIdx
        break
      }
    }

    if (headerIndex === -1) {
      headerIndex = 0
      dateIdx = 0
      descIdx = 2
      amountIdx = 3
    }

    const buildDescription = (cells: string[]) => {
      const concept = cells[descIdx] || ''
      const movement = movementIdx >= 0 ? cells[movementIdx] : ''
      const observations = observationsIdx >= 0 ? cells[observationsIdx] : ''
      const normalizedMovement = normalizeText(movement)
      const normalizedConcept = normalizeText(concept)
      const isUsefulMovement =
        movement &&
        movement !== concept &&
        !['pago con tarjeta', 'otros'].includes(normalizedMovement)
      const isUsefulObservation =
        observations &&
        !observations.startsWith('460') &&
        normalizeText(observations) !== normalizedMovement &&
        normalizeText(observations) !== normalizedConcept

      if (isUsefulMovement) {
        return `${concept || 'Movimiento bancario'} - ${movement}`.trim()
      }

      if (!concept && isUsefulObservation) {
        return observations
      }

      return concept || movement || observations || 'Movimiento bancario'
    }

    const movements: ParsedMovement[] = []

    for (let i = headerIndex + 1; i < normalizedRows.length; i++) {
      const cells = normalizedRows[i]
      const finalDate = formatDate(cells[dateIdx])
      if (!finalDate) continue

      const description = buildDescription(cells)
      let parsedAmount = amountIdx >= 0 ? parseSpanishAmount(cells[amountIdx]) : NaN

      if ((Number.isNaN(parsedAmount) || parsedAmount === 0) && (debitIdx >= 0 || creditIdx >= 0)) {
        const debit = debitIdx >= 0 ? Math.abs(parseSpanishAmount(cells[debitIdx]) || 0) : 0
        const credit = creditIdx >= 0 ? Math.abs(parseSpanishAmount(cells[creditIdx]) || 0) : 0
        parsedAmount = credit > 0 ? credit : -debit
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount === 0) continue

      const type: TransactionType = parsedAmount > 0 ? 'income' : 'expense'
      const finalAmount = Math.abs(parsedAmount)
      const categoryId = guessCategory(description, type)

      movements.push({
        tempId: `tmp_${i}_${Date.now()}`,
        date: finalDate,
        description,
        original_description: description,
        amount: finalAmount,
        type,
        categoryId,
        selected: Boolean(categoryId),
      })
    }

    if (movements.length === 0) {
      throw new Error('No se detectaron movimientos válidos en el archivo. Verifica el formato.')
    }

    return movements
  }

  const parseCsvText = (text: string): ParsedMovement[] => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const probe = lines.slice(0, 20).join('\n')
    const semicolons = (probe.match(/;/g) || []).length
    const commas = (probe.match(/,/g) || []).length
    const delimiter = semicolons >= commas ? ';' : ','
    return parseRows(lines.map((line) => splitCsvLine(line, delimiter)))
  }

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setParsing(true)
    setError(null)

    const extension = selectedFile.name.split('.').pop()?.toLowerCase()
    const isExcel = extension === 'xlsx' || extension === 'xls'

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        if (!event.target?.result) {
          throw new Error('El archivo está vacío.')
        }

        if (isExcel) {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(event.target.result as ArrayBuffer, {
            type: 'array',
            cellDates: true,
          })
          const firstSheetName = workbook.SheetNames[0]
          if (!firstSheetName) {
            throw new Error('El Excel no tiene hojas con movimientos.')
          }
          const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
            header: 1,
            blankrows: false,
            raw: false,
          }) as RawTable
          setParsedMovements(parseRows(rows))
        } else {
          const text = event.target.result as string
          setParsedMovements(parseCsvText(text))
        }
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

    if (isExcel) {
      reader.readAsArrayBuffer(selectedFile)
    } else {
      reader.readAsText(selectedFile, 'ISO-8859-1')
    }
  }

  // Toggle selection
  const handleToggleRow = (tempId: string) => {
    setParsedMovements((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, selected: !m.selected } : m))
    )
  }

  // Change category of single parsed movement
  const handleCategoryChange = (tempId: string, categoryId: string) => {
    if (categoryId === '__new__') {
      const row = parsedMovements.find((m) => m.tempId === tempId)
      if (row) {
        setCreatingCategoryRow(row)
        setNewCatName('')
        setNewCatColor('#22C55E')
        setCatError(null)
      }
      return
    }

    setParsedMovements((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, categoryId } : m))
    )
  }

  const handleCreateCategory = async () => {
    if (!creatingCategoryRow || !newCatName.trim()) return

    setCreatingCat(true)
    setCatError(null)

    try {
      const result = await saveCategory(supabase, {
        userId,
        name: newCatName.trim(),
        type: creatingCategoryRow.type,
        colorCode: newCatColor,
      })

      if (result.error) {
        setCatError(result.error)
      } else if (result.data) {
        const newCatId = result.data.id
        await onImportComplete()
        
        setParsedMovements((prev) =>
          prev.map((m) =>
            m.tempId === creatingCategoryRow.tempId ? { ...m, categoryId: newCatId } : m
          )
        )
        setCreatingCategoryRow(null)
      }
    } catch (err) {
      setCatError('Error al crear la categoría.')
    } finally {
      setCreatingCat(false)
    }
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

  const getUniqueMovements = (movements: ParsedMovement[]) => {
    const seen = new Set<string>()

    return movements.filter((movement) => {
      const key = transactionDuplicateKey(movement)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const handleImport = async () => {
    const selectedMovements = getUniqueMovements(parsedMovements.filter((m) => m.selected))
    if (selectedMovements.length === 0) return

    setImporting(true)
    setError(null)

    try {
      const dates = selectedMovements.map((movement) => movement.date).sort()
      const { data: existing, error: existingError } = await supabase
        .from('transactions')
        .select('date,amount,type,description,original_description')
        .eq('user_id', userId)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])

      if (existingError) {
        throw new Error(existingError.message || 'No se pudieron revisar duplicados.')
      }

      const existingKeys = new Set(
        (existing || []).map((transaction) => transactionDuplicateKey(transaction))
      )
      const newMovements = selectedMovements.filter(
        (movement) => !existingKeys.has(transactionDuplicateKey(movement))
      )
      const skippedCount = selectedMovements.length - newMovements.length

      if (newMovements.length === 0) {
        throw new Error('Todos esos movimientos ya estaban importados.')
      }

      const insertData = newMovements.map((m) => ({
        user_id: userId,
        amount: m.amount,
        date: m.date,
        description: m.description,
        original_description: m.original_description,
        category_id: m.categoryId,
        type: m.type,
      }))

      const { error: insertError } = await supabase.from('transactions').insert(insertData)
      if (insertError) {
        throw new Error(insertError.message || 'No se pudieron guardar los movimientos.')
      }

      await onImportComplete()
      if (skippedCount > 0) {
        setError(`Importados ${newMovements.length}. Saltados ${skippedCount} duplicados.`)
        setParsedMovements([])
        return
      }
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
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                  />
                  <span className="text-4xl mb-3 text-gray-600 group-hover:text-neonCyan transition-colors">⤓</span>
                  <p className="text-sm font-semibold text-white">Arrastra el Excel de tu banco aquí</p>
                  <p className="text-xs text-gray-500 mt-1">O haz clic para explorar tus archivos (.xlsx, .xls, .csv)</p>
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
                            <option value="__new__" className="text-neonCyan font-semibold">
                              + Nueva Categoría...
                            </option>
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

            {creatingCategoryRow && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="glass w-full max-w-sm rounded-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <h4 className="text-md font-bold text-white">Nueva Categoría</h4>
                  {catError && <p className="text-xs text-neonMagenta">{catError}</p>}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ej. Gimnasio, Regalos..."
                      className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Color</label>
                    <div className="flex gap-2 justify-between">
                      {['#FF2D55', '#22C55E', '#00D9FF', '#A855F7', '#F97316', '#EAB308', '#64748B'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCatColor(c)}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                            newCatColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCreatingCategoryRow(null)}
                      className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-semibold text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={creatingCat || !newCatName.trim()}
                      onClick={handleCreateCategory}
                      className="flex-1 rounded-lg bg-neonCyan py-2 text-xs font-semibold text-background shadow-cyan disabled:opacity-50"
                    >
                      {creatingCat ? 'Creando...' : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
