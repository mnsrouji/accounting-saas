'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  Plus,
  ArrowLeft,
  RotateCcw,
  Eye,
  FileText,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ShieldAlert,
  Coins,
  Globe,
  ArrowRightLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import {
  postJournalEntryAction,
  reverseJournalEntryAction,
  updateJournalEntryAction,
  deleteJournalEntryAction,
} from '@/actions/accounting/accounting-actions'

interface JournalLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description?: string
  currencyCode?: string
  exchangeRate?: number
  debitAmount: number
  creditAmount: number
  baseDebit?: number
  baseCredit?: number
}

interface JournalEntryRow {
  id: string
  entryNumber: string
  entryDate: string
  description?: string
  sourceType: string | null
  sourceId?: string
  reversedEntryId?: string
  status: string
  currencyCode: string
  exchangeRate: number
  lines: JournalLine[]
}

interface AccountOption {
  id: string
  code: string
  name: string
  type?: string
  isHeader?: boolean
  isActive?: boolean
}

interface CurrencyOption {
  code: string
  name: string
  symbol: string
}

interface ExchangeRateOption {
  fromCurrency: string
  toCurrency: string
  rate: number
}

interface JournalEntriesClientProps {
  businessId: string
  defaultCurrency: string
  entries: JournalEntryRow[]
  accounts: AccountOption[]
  currencies?: CurrencyOption[]
  exchangeRates?: ExchangeRateOption[]
}

const DEFAULT_CURRENCY_LIST: CurrencyOption[] = [
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.أ' },
]

// Formatter to render intuitive rates like "1 USD = 48.70 TRY" or "1 EUR = 1.08 USD"
export function formatExchangeRateDisplay(cur: string, effectiveRate: number, baseCurrency: string = 'USD'): string {
  if (!cur || cur === baseCurrency || effectiveRate === 1) return baseCurrency
  if (effectiveRate <= 0) return '1'
  if (effectiveRate < 1) {
    const inv = Number((1 / effectiveRate).toFixed(4))
    return `1 ${baseCurrency} = ${inv} ${cur}`
  }
  return `1 ${cur} = ${Number(effectiveRate.toFixed(4))} ${baseCurrency}`
}

export function JournalEntriesClient({
  businessId,
  defaultCurrency,
  entries,
  accounts,
  currencies = [],
  exchangeRates = [],
}: JournalEntriesClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  // Combine available currencies ensuring defaultCurrency is always first
  const availableCurrencies: CurrencyOption[] = useMemo(() => {
    const list = currencies.length > 0 ? [...currencies] : [...DEFAULT_CURRENCY_LIST]
    if (!list.some((c) => c.code === defaultCurrency)) {
      list.unshift({ code: defaultCurrency, name: defaultCurrency, symbol: defaultCurrency })
    }
    return list
  }, [currencies, defaultCurrency])

  /**
   * Helper to retrieve human-intuitive default rate & quotation direction.
   * By default, when base is USD and currency is TRY/SAR/EGP/AED/etc:
   * Returns displayRate = 48.70 and mode = 'USD_TO_CUR' (i.e. 1 USD = 48.70 TRY).
   */
  const getSuggestedRateInfo = (cur: string): { displayRate: number; mode: 'USD_TO_CUR' | 'CUR_TO_USD' } => {
    if (!cur || cur === defaultCurrency) {
      return { displayRate: 1, mode: 'USD_TO_CUR' }
    }

    // 1. Check exact USD -> CUR rate in DB
    const usdToCur = exchangeRates.find((r) => r.fromCurrency === defaultCurrency && r.toCurrency === cur)
    if (usdToCur && Number(usdToCur.rate) > 0) {
      const r = Number(usdToCur.rate)
      return { displayRate: r, mode: 'USD_TO_CUR' }
    }

    // 2. Check CUR -> USD rate in DB
    const curToUsd = exchangeRates.find((r) => r.fromCurrency === cur && r.toCurrency === defaultCurrency)
    if (curToUsd && Number(curToUsd.rate) > 0) {
      const r = Number(curToUsd.rate)
      if (r < 1) {
        // e.g. 0.020534 -> human rate is 1/0.020534 = 48.70
        return { displayRate: Number((1 / r).toFixed(4)), mode: 'USD_TO_CUR' }
      }
      return { displayRate: r, mode: 'CUR_TO_USD' }
    }

    // 3. Fallback defaults for common currencies
    if (cur === 'TRY') return { displayRate: 34.5, mode: 'USD_TO_CUR' }
    if (cur === 'SAR') return { displayRate: 3.75, mode: 'USD_TO_CUR' }
    if (cur === 'AED') return { displayRate: 3.67, mode: 'USD_TO_CUR' }
    if (cur === 'EGP') return { displayRate: 48.5, mode: 'USD_TO_CUR' }
    if (cur === 'EUR') return { displayRate: 1.08, mode: 'CUR_TO_USD' }
    if (cur === 'GBP') return { displayRate: 1.3, mode: 'CUR_TO_USD' }
    if (cur === 'KWD') return { displayRate: 3.25, mode: 'CUR_TO_USD' }

    return { displayRate: 1, mode: 'USD_TO_CUR' }
  }

  const [selectedEntry, setSelectedEntry] = useState<JournalEntryRow | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reversal state
  const [reversalReason, setReversalReason] = useState('')

  // New Journal Entry state
  const [newEntryNumber, setNewEntryNumber] = useState(`JE-MAN-${Date.now().toString().slice(-6)}`)
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [newCurrencyCode, setNewCurrencyCode] = useState(defaultCurrency)
  const [newDisplayRate, setNewDisplayRate] = useState<number>(1)
  const [newRateMode, setNewRateMode] = useState<'USD_TO_CUR' | 'CUR_TO_USD'>('USD_TO_CUR')
  const [newMultiCurrencyPerLine, setNewMultiCurrencyPerLine] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newLines, setNewLines] = useState<
    {
      accountId: string
      description: string
      currencyCode: string
      effectiveRate: number // multiplier to convert line currency into base USD
      debitAmount: number
      creditAmount: number
    }[]
  >([
    { accountId: accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
    { accountId: accounts[1]?.id || accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
  ])

  // Edit Journal Entry state
  const [editingEntry, setEditingEntry] = useState<JournalEntryRow | null>(null)
  const [editEntryDate, setEditEntryDate] = useState('')
  const [editCurrencyCode, setEditCurrencyCode] = useState(defaultCurrency)
  const [editDisplayRate, setEditDisplayRate] = useState<number>(1)
  const [editRateMode, setEditRateMode] = useState<'USD_TO_CUR' | 'CUR_TO_USD'>('USD_TO_CUR')
  const [editMultiCurrencyPerLine, setEditMultiCurrencyPerLine] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editLines, setEditLines] = useState<
    {
      accountId: string
      description: string
      currencyCode: string
      effectiveRate: number
      debitAmount: number
      creditAmount: number
    }[]
  >([])

  // Delete Journal Entry state
  const [deletingEntry, setDeletingEntry] = useState<JournalEntryRow | null>(null)

  // Compute effective rate multiplier for new header
  const newEffectiveRate = useMemo(() => {
    if (newCurrencyCode === defaultCurrency) return 1
    if (newDisplayRate <= 0) return 1
    return newRateMode === 'USD_TO_CUR' ? 1 / newDisplayRate : newDisplayRate
  }, [newCurrencyCode, defaultCurrency, newDisplayRate, newRateMode])

  // Calculations for New Entry
  const totalDebitsBase = newLines.reduce((acc, l) => acc + (Number(l.debitAmount) || 0) * (Number(l.effectiveRate) || 1), 0)
  const totalCreditsBase = newLines.reduce((acc, l) => acc + (Number(l.creditAmount) || 0) * (Number(l.effectiveRate) || 1), 0)
  const differenceBase = Math.abs(totalDebitsBase - totalCreditsBase)
  const isBalanced = differenceBase < 0.005 && totalDebitsBase > 0

  const totalDebitsOriginal = newLines.reduce((acc, l) => acc + (Number(l.debitAmount) || 0), 0)
  const totalCreditsOriginal = newLines.reduce((acc, l) => acc + (Number(l.creditAmount) || 0), 0)

  // Handlers for New Entry
  const handleCurrencyChange = (newCur: string) => {
    setNewCurrencyCode(newCur)
    const { displayRate, mode } = getSuggestedRateInfo(newCur)
    setNewDisplayRate(displayRate)
    setNewRateMode(mode)

    const effective = newCur === defaultCurrency ? 1 : mode === 'USD_TO_CUR' ? (displayRate > 0 ? 1 / displayRate : 1) : displayRate

    setNewLines((prev) =>
      prev.map((l) => ({
        ...l,
        currencyCode: newCur,
        effectiveRate: effective,
      }))
    )
  }

  const handleToggleRateMode = () => {
    if (newCurrencyCode === defaultCurrency || newDisplayRate <= 0) return
    const newMode = newRateMode === 'USD_TO_CUR' ? 'CUR_TO_USD' : 'USD_TO_CUR'
    const newRate = Number((1 / newDisplayRate).toFixed(4))
    setNewRateMode(newMode)
    setNewDisplayRate(newRate)
  }

  const handleAddLine = () => {
    setNewLines((prev) => [
      ...prev,
      {
        accountId: accounts[0]?.id || '',
        description: '',
        currencyCode: newCurrencyCode,
        effectiveRate: newEffectiveRate,
        debitAmount: 0,
        creditAmount: 0,
      },
    ])
  }

  const handleRemoveLine = (index: number) => {
    if (newLines.length <= 2) {
      toast.error(isAr ? 'يجب أن يحتوي القيد على سطرين على الأقل (مبدأ القيد المزدوج).' : 'A journal entry must contain at least 2 lines.')
      return
    }
    setNewLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleAutoBalance = () => {
    const diff = totalDebitsBase - totalCreditsBase
    if (Math.abs(diff) < 0.005) {
      toast.info(isAr ? 'القيد متوازن بالفعل بالعملة الأساسية.' : 'Entry is already balanced.')
      return
    }

    const effective = newEffectiveRate > 0 ? newEffectiveRate : 1
    const originalDiff = Number((Math.abs(diff) / effective).toFixed(2))

    if (diff > 0) {
      setNewLines((prev) => [
        ...prev,
        {
          accountId: accounts[1]?.id || accounts[0]?.id || '',
          description: newDescription || (isAr ? 'سطر موازنة دائن' : 'Balancing credit line'),
          currencyCode: newCurrencyCode,
          effectiveRate: effective,
          debitAmount: 0,
          creditAmount: originalDiff,
        },
      ])
      toast.success(
        isAr
          ? `تمت إضافة سطر دائن بقيمة ${formatCurrency(originalDiff, newCurrencyCode)} (${formatCurrency(diff, defaultCurrency)}) لموازنة القيد.`
          : `Added credit line of ${formatCurrency(originalDiff, newCurrencyCode)} to balance the entry.`
      )
    } else {
      const absDiff = Math.abs(diff)
      setNewLines((prev) => [
        ...prev,
        {
          accountId: accounts[0]?.id || '',
          description: newDescription || (isAr ? 'سطر موازنة مدين' : 'Balancing debit line'),
          currencyCode: newCurrencyCode,
          effectiveRate: effective,
          debitAmount: originalDiff,
          creditAmount: 0,
        },
      ])
      toast.success(
        isAr
          ? `تمت إضافة سطر مدين بقيمة ${formatCurrency(originalDiff, newCurrencyCode)} (${formatCurrency(absDiff, defaultCurrency)}) لموازنة القيد.`
          : `Added debit line of ${formatCurrency(originalDiff, newCurrencyCode)} to balance the entry.`
      )
    }
  }

  // Compute effective rate multiplier for edit header
  const editEffectiveRate = useMemo(() => {
    if (editCurrencyCode === defaultCurrency) return 1
    if (editDisplayRate <= 0) return 1
    return editRateMode === 'USD_TO_CUR' ? 1 / editDisplayRate : editDisplayRate
  }, [editCurrencyCode, defaultCurrency, editDisplayRate, editRateMode])

  // Calculations for Edit Entry
  const editTotalDebitsBase = editLines.reduce((acc, l) => acc + (Number(l.debitAmount) || 0) * (Number(l.effectiveRate) || 1), 0)
  const editTotalCreditsBase = editLines.reduce((acc, l) => acc + (Number(l.creditAmount) || 0) * (Number(l.effectiveRate) || 1), 0)
  const editDifferenceBase = Math.abs(editTotalDebitsBase - editTotalCreditsBase)
  const isEditBalanced = editDifferenceBase < 0.005 && editTotalDebitsBase > 0

  const handleOpenView = (entry: JournalEntryRow) => {
    setSelectedEntry(entry)
    setIsViewModalOpen(true)
  }

  const handleOpenReverse = (entry: JournalEntryRow) => {
    setSelectedEntry(entry)
    setReversalReason('')
    setIsReverseModalOpen(true)
  }

  const handleOpenEdit = (entry: JournalEntryRow) => {
    setEditingEntry(entry)
    setEditEntryDate(new Date(entry.entryDate).toISOString().split('T')[0])
    setEditCurrencyCode(entry.currencyCode || defaultCurrency)

    const storedRate = Number(entry.exchangeRate) || 1
    if (storedRate < 1 && entry.currencyCode !== defaultCurrency) {
      setEditDisplayRate(Number((1 / storedRate).toFixed(4)))
      setEditRateMode('USD_TO_CUR')
    } else {
      setEditDisplayRate(storedRate)
      setEditRateMode(entry.currencyCode === 'EUR' || entry.currencyCode === 'GBP' ? 'CUR_TO_USD' : 'USD_TO_CUR')
    }

    setEditDescription(entry.description || '')

    const hasMultiCurrencies = entry.lines.some((l) => (l.currencyCode && l.currencyCode !== entry.currencyCode) || (l.exchangeRate && l.exchangeRate !== entry.exchangeRate))
    setEditMultiCurrencyPerLine(hasMultiCurrencies)

    setEditLines(
      entry.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description || '',
        currencyCode: l.currencyCode || entry.currencyCode || defaultCurrency,
        effectiveRate: Number(l.exchangeRate) || Number(entry.exchangeRate) || 1,
        debitAmount: Number(l.debitAmount) || 0,
        creditAmount: Number(l.creditAmount) || 0,
      }))
    )
    setIsEditModalOpen(true)
  }

  const handleEditCurrencyChange = (newCur: string) => {
    setEditCurrencyCode(newCur)
    const { displayRate, mode } = getSuggestedRateInfo(newCur)
    setEditDisplayRate(displayRate)
    setEditRateMode(mode)

    const effective = newCur === defaultCurrency ? 1 : mode === 'USD_TO_CUR' ? (displayRate > 0 ? 1 / displayRate : 1) : displayRate

    setEditLines((prev) =>
      prev.map((l) => ({
        ...l,
        currencyCode: newCur,
        effectiveRate: effective,
      }))
    )
  }

  const handleToggleEditRateMode = () => {
    if (editCurrencyCode === defaultCurrency || editDisplayRate <= 0) return
    const newMode = editRateMode === 'USD_TO_CUR' ? 'CUR_TO_USD' : 'USD_TO_CUR'
    const newRate = Number((1 / editDisplayRate).toFixed(4))
    setEditRateMode(newMode)
    setEditDisplayRate(newRate)
  }

  const handleAddEditLine = () => {
    setEditLines((prev) => [
      ...prev,
      {
        accountId: accounts[0]?.id || '',
        description: '',
        currencyCode: editCurrencyCode,
        effectiveRate: editEffectiveRate,
        debitAmount: 0,
        creditAmount: 0,
      },
    ])
  }

  const handleRemoveEditLine = (index: number) => {
    if (editLines.length <= 2) {
      toast.error(isAr ? 'يجب أن يحتوي القيد على سطرين على الأقل (مبدأ القيد المزدوج).' : 'A journal entry must contain at least 2 lines.')
      return
    }
    setEditLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleAutoBalanceEdit = () => {
    const diff = editTotalDebitsBase - editTotalCreditsBase
    if (Math.abs(diff) < 0.005) {
      toast.info(isAr ? 'القيد متوازن بالفعل بالعملة الأساسية.' : 'Entry is already balanced.')
      return
    }

    const effective = editEffectiveRate > 0 ? editEffectiveRate : 1
    const originalDiff = Number((Math.abs(diff) / effective).toFixed(2))

    if (diff > 0) {
      setEditLines((prev) => [
        ...prev,
        {
          accountId: accounts[1]?.id || accounts[0]?.id || '',
          description: editDescription || (isAr ? 'سطر دائن موازن' : 'Balancing credit line'),
          currencyCode: editCurrencyCode,
          effectiveRate: effective,
          debitAmount: 0,
          creditAmount: originalDiff,
        },
      ])
      toast.success(
        isAr
          ? `تمت إضافة سطر دائن بقيمة ${formatCurrency(originalDiff, editCurrencyCode)} لموازنة القيد.`
          : `Added credit line of ${formatCurrency(originalDiff, editCurrencyCode)} to balance the entry.`
      )
    } else {
      const absDiff = Math.abs(diff)
      setEditLines((prev) => [
        ...prev,
        {
          accountId: accounts[0]?.id || '',
          description: editDescription || (isAr ? 'سطر مدين موازن' : 'Balancing debit line'),
          currencyCode: editCurrencyCode,
          effectiveRate: effective,
          debitAmount: originalDiff,
          creditAmount: 0,
        },
      ])
      toast.success(
        isAr
          ? `تمت إضافة سطر مدين بقيمة ${formatCurrency(originalDiff, editCurrencyCode)} لموازنة القيد.`
          : `Added debit line of ${formatCurrency(originalDiff, editCurrencyCode)} to balance the entry.`
      )
    }
  }

  const handleExecuteUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntry) return

    if (editLines.length < 2) {
      toast.error(isAr ? 'يجب أن يحتوي القيد على سطرين على الأقل' : 'At least 2 lines are required')
      return
    }

    if (!isEditBalanced) {
      toast.error(
        isAr
          ? 'يجب أن يكون إجمالي المدين مساوياً لإجمالي الدائن بالعملة الأساسية وأكبر من الصفر!'
          : 'Total Base Debits and Credits must be equal and greater than 0!'
      )
      return
    }

    for (let i = 0; i < editLines.length; i++) {
      const line = editLines[i]
      if (!line.accountId) {
        toast.error(isAr ? `يرجى تحديد حساب للسطر رقم ${i + 1}` : `Please select an account for line #${i + 1}`)
        return
      }
      if (line.debitAmount <= 0 && line.creditAmount <= 0) {
        toast.error(isAr ? `السطر رقم ${i + 1} يجب أن يحتوي على مبلغ مدين أو دائن أكبر من الصفر` : `Line #${i + 1} must have a positive amount`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await updateJournalEntryAction(businessId, {
        journalEntryId: editingEntry.id,
        entryDate: new Date(editEntryDate),
        description: editDescription.trim() || undefined,
        currencyCode: editCurrencyCode,
        exchangeRate: Number(editEffectiveRate) || 1,
        lines: editLines.map((l) => ({
          accountId: l.accountId,
          description: l.description.trim() || editDescription.trim() || undefined,
          currencyCode: l.currencyCode || editCurrencyCode,
          exchangeRate: Number(l.effectiveRate) || Number(editEffectiveRate) || 1,
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
        })),
      })

      if (res.success) {
        toast.success(isAr ? `تم تعديل القيد ${editingEntry.entryNumber} بنجاح!` : `Journal entry updated successfully!`)
        setIsEditModalOpen(false)
        setEditingEntry(null)
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل في تعديل القيد' : 'Failed to update entry'))
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDelete = (entry: JournalEntryRow) => {
    setDeletingEntry(entry)
    setIsDeleteModalOpen(true)
  }

  const handleExecuteDelete = async () => {
    if (!deletingEntry) return

    setLoading(true)
    try {
      const res = await deleteJournalEntryAction(businessId, deletingEntry.id)
      if (res.success) {
        toast.success(isAr ? `تم حذف القيد ${deletingEntry.entryNumber} بنجاح!` : `Journal entry deleted successfully!`)
        setIsDeleteModalOpen(false)
        setDeletingEntry(null)
        router.refresh()
      } else {
        toast.error(res.error || 'فشل في حذف القيد')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حذف القيد')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEntry || !reversalReason.trim()) {
      toast.error(isAr ? 'يرجى كتابة سبب عكس القيد' : 'Please state a reason for reversal')
      return
    }

    setLoading(true)
    try {
      const res = await reverseJournalEntryAction(businessId, {
        journalEntryId: selectedEntry.id,
        reversalEntryNumber: `REV-${selectedEntry.entryNumber}`,
        reversalDate: new Date(),
        reason: reversalReason,
      })

      if (res.success) {
        toast.success(isAr ? `تم عكس القيد ${selectedEntry.entryNumber} بنجاح!` : `Journal entry reversed successfully!`)
        setIsReverseModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to reverse journal entry')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newLines.length < 2) {
      toast.error(isAr ? 'يجب أن يحتوي القيد على سطرين على الأقل' : 'At least 2 lines are required')
      return
    }

    if (!isBalanced) {
      toast.error(
        isAr
          ? 'يجب أن يتساوى إجمالي المدين والدائن بالعملة الأساسية (معيار المحاسبة الدولي IAS 21)!'
          : 'Total Base Debits and Credits must be equal and greater than 0!'
      )
      return
    }

    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i]
      if (!line.accountId) {
        toast.error(isAr ? `يرجى تحديد حساب للسطر رقم ${i + 1}` : `Please select an account for line #${i + 1}`)
        return
      }
      if (line.debitAmount <= 0 && line.creditAmount <= 0) {
        toast.error(isAr ? `السطر رقم ${i + 1} يجب أن يحتوي على مبلغ أكبر من الصفر` : `Line #${i + 1} must have a positive amount`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await postJournalEntryAction(businessId, {
        entryNumber: newEntryNumber,
        entryDate: new Date(newEntryDate),
        description: newDescription || undefined,
        currencyCode: newCurrencyCode,
        exchangeRate: Number(newEffectiveRate) || 1,
        sourceType: 'manual',
        lines: newLines.map((l) => ({
          accountId: l.accountId,
          description: l.description.trim() || newDescription || undefined,
          currencyCode: l.currencyCode || newCurrencyCode,
          exchangeRate: Number(l.effectiveRate) || Number(newEffectiveRate) || 1,
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
        })),
      })

      if (res.success) {
        toast.success(isAr ? `تم ترحيل القيد ${newEntryNumber} بنجاح!` : `Journal Entry ${newEntryNumber} posted successfully!`)
        setIsNewModalOpen(false)
        setNewEntryNumber(`JE-MAN-${Date.now().toString().slice(-6)}`)
        setNewDescription('')
        setNewCurrencyCode(defaultCurrency)
        setNewDisplayRate(1)
        setNewRateMode('USD_TO_CUR')
        setNewLines([
          { accountId: accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
          { accountId: accounts[1]?.id || accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
        ])
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل في ترحيل القيد' : 'Failed to post journal entry'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const t = {
    title: isAr ? 'قيود اليومية العامة' : isTr ? 'Yevmiye Kayıtları' : 'Journal Entries',
    subtitle: isAr
      ? 'القيود المحاسبية المركبة والمدققة (من مذكورين إلى مذكورين) مع دعم العملات المتعددة (IAS 21)'
      : isTr
      ? 'Denetlenebilir bileşik yevmiye kayıtları ve çoklu para birimi desteği'
      : 'Auditable multi-line compound journal entries with multi-currency (IAS 21) support',
    newEntry: isAr ? 'قيد يومية جديد' : isTr ? 'Yeni Yevmiye Kaydı' : 'New Journal Entry',
    backToHub: isAr ? 'العودة لمركز المحاسبة' : isTr ? 'Muhasebeye Dön' : 'Back to Accounting Hub',
    entryNumber: isAr ? 'رقم القيد' : isTr ? 'Kayıt No' : 'Entry #',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    description: isAr ? 'البيان' : isTr ? 'Açıklama' : 'Description',
    currency: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    rate: isAr ? 'سعر الصرف' : isTr ? 'Döviz Kuru' : 'Exchange Rate',
    multiCurrency: isAr ? 'العملات المتعددة' : isTr ? 'Çoklu Para Birimi' : 'Multi-Currency',
    perLineCurrency: isAr ? 'تخصيص عملة وسعر صرف لكل سطر' : isTr ? 'Satır bazında para birimi/kur belirle' : 'Set currency/rate per line',
    source: isAr ? 'المصدر' : isTr ? 'Kaynak' : 'Source',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    searchPlaceholder: isAr ? 'بحث برقم القيد أو البيان أو العملة...' : 'Search journal entry # or description...',
    emptyTitle: isAr ? 'لا توجد قيود يومية' : isTr ? 'Yevmiye Kaydı Bulunamadı' : 'No Journal Entries',
    emptySubtext: isAr
      ? 'يتم إنشاء القيود تلقائياً عند ترحيل الفواتير والسندات أو يدوياً.'
      : 'Journal entries are automatically created when posting sales, purchases, payments or manually.',
    viewTitle: (num: string) => (isAr ? `تفاصيل القيد: ${num}` : `Journal Entry: ${num}`),
    editTitle: (num: string) => (isAr ? `تعديل القيد المحاسبي: ${num}` : `Edit Journal Entry: ${num}`),
    deleteTitle: isAr ? 'تأكيد حذف القيد المحاسبي' : 'Confirm Delete Journal Entry',
    reverseTitle: (num: string) => (isAr ? `عكس القيد المحاسبي: ${num}` : `Reverse Journal Entry: ${num}`),
    account: isAr ? 'الحساب المالي' : isTr ? 'Hesap' : 'Account',
    memo: isAr ? 'البيان / الشرح' : isTr ? 'Açıklama' : 'Memo',
    debit: isAr ? 'مدين' : isTr ? 'Borç' : 'Debit',
    credit: isAr ? 'دائن' : isTr ? 'Alacak' : 'Credit',
    baseDebit: isAr ? 'مدين (أساسي)' : isTr ? 'Borç (Ana Para)' : 'Base Debit',
    baseCredit: isAr ? 'دائن (أساسي)' : isTr ? 'Alacak (Ana Para)' : 'Base Credit',
    totalDebits: isAr ? 'إجمالي المدين' : isTr ? 'Toplam Borç' : 'Total Debits',
    totalCredits: isAr ? 'إجمالي الدائن' : isTr ? 'Toplam Alacak' : 'Total Credits',
    totalBaseDebits: isAr ? 'إجمالي المدين (العملة الأساسية)' : 'Total Base Debits',
    totalBaseCredits: isAr ? 'إجمالي الدائن (العملة الأساسية)' : 'Total Base Credits',
    diff: isAr ? 'الفارق' : isTr ? 'Fark' : 'Difference',
    balanced: isAr ? '✓ القيد متوازن بالعملة الأساسية' : isTr ? '✓ Dengelendi' : '✓ Balanced (IAS 21)',
    unbalanced: isAr ? '⚠️ غير متوازن' : isTr ? '⚠️ Dengesiz' : '⚠️ Unbalanced',
    autoBalance: isAr ? '⚖️ موازنة تلقائية' : isTr ? '⚖️ Otomatik Dengele' : '⚖️ Auto-Balance',
    addLine: isAr ? 'إضافة سطر' : isTr ? 'Satır Ekle' : 'Add Line',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    postEntry: isAr ? 'ترحيل القيد' : isTr ? 'Kaydı Onayla' : 'Post Entry',
    posting: isAr ? 'جاري الترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...',
    saveChanges: isAr ? 'حفظ التعديلات' : isTr ? 'Değişiklikleri Kaydet' : 'Save Changes',
    saving: isAr ? 'جاري الحفظ والتعديل...' : isTr ? 'Kaydediliyor...' : 'Saving...',
    deleteBtn: isAr ? 'تأكيد حذف القيد' : isTr ? 'Kaydı Sil' : 'Delete Entry',
    deleting: isAr ? 'جاري الحذف...' : isTr ? 'Siliniyor...' : 'Deleting...',
    reverseBtn: isAr ? 'تنفيذ عكس القيد' : isTr ? 'Ters Kaydı Çalıştır' : 'Execute Reversal',
    reversing: isAr ? 'جاري العكس...' : isTr ? 'İşleniyor...' : 'Reversing...',
    searchAccountPlaceholder: isAr ? '-- ابحث برقم أو اسم الحساب --' : '-- Search or select account --',
    postManualTitle: isAr ? 'إدخال قيد يومية يدوي' : isTr ? 'Manuel Yevmiye Kaydı Gir' : 'Post Manual Journal Entry',
    postManualSub: isAr
      ? 'إنشاء قيد محاسبي مركب ومزدوج (من مذكورين إلى مذكورين) متعدد العملات'
      : 'Create a compound double-entry multi-currency journal transaction',
    statuses: {
      posted: isAr ? 'مرحل' : isTr ? 'Onaylandı' : 'Posted',
      reversed: isAr ? 'معكوس' : isTr ? 'Ters Çevrildi' : 'Reversed',
      draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
    },
  }

  const columns: Column<JournalEntryRow>[] = [
    {
      key: 'entryNumber',
      header: t.entryNumber,
      sortable: true,
      sortValue: (r) => r.entryNumber,
      accessor: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleOpenView(r)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-brand-600)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {r.entryNumber}
          </button>
          {r.currencyCode !== defaultCurrency && (
            <span
              className="badge badge-warning"
              style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem', fontWeight: 600 }}
              title={formatExchangeRateDisplay(r.currencyCode, Number(r.exchangeRate) || 1, defaultCurrency)}
            >
              {r.currencyCode} ({formatExchangeRateDisplay(r.currencyCode, Number(r.exchangeRate) || 1, defaultCurrency)})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'entryDate',
      header: t.date,
      sortable: true,
      sortValue: (r) => new Date(r.entryDate).getTime(),
      accessor: (r) => formatDate(r.entryDate),
    },
    {
      key: 'description',
      header: t.description,
      sortable: true,
      sortValue: (r) => r.description || '',
      accessor: (r) => (
        <div style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.description || '—'}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: isAr ? 'إجمالي القيد' : isTr ? 'Toplam Tutar' : 'Total Amount',
      accessor: (r) => {
        const totalDebitsOrig = r.lines.reduce((acc, l) => acc + (Number(l.debitAmount) || 0), 0)
        const totalBase = r.lines.reduce((acc, l) => acc + (Number(l.baseDebit) || Number(l.debitAmount) * (Number(l.exchangeRate) || 1)), 0)

        if (r.currencyCode !== defaultCurrency) {
          return (
            <div>
              <div style={{ fontWeight: 600 }}>{formatCurrency(totalDebitsOrig, r.currencyCode)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                ≈ {formatCurrency(totalBase, defaultCurrency)}
              </div>
            </div>
          )
        }
        return <span style={{ fontWeight: 600 }}>{formatCurrency(totalBase, defaultCurrency)}</span>
      },
    },
    {
      key: 'sourceType',
      header: t.source,
      sortable: true,
      sortValue: (r) => r.sourceType || '',
      accessor: (r) => <span className="badge badge-secondary">{r.sourceType}</span>,
    },
    {
      key: 'status',
      header: t.status,
      sortable: true,
      sortValue: (r) => r.status,
      accessor: (r) => {
        let badge = 'badge-primary'
        if (r.status === 'posted') badge = 'badge-success'
        if (r.status === 'reversed') badge = 'badge-danger'
        return <span className={`badge ${badge}`}>{t.statuses[r.status as keyof typeof t.statuses] || r.status}</span>
      },
    },
    {
      key: 'actions',
      header: t.actions,
      hideable: false,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleOpenView(r)}
            style={{ height: 30, padding: '0 0.5rem' }}
            title={isAr ? 'عرض تفاصيل القيد' : 'View details'}
          >
            <Eye size={14} />
          </button>
          {r.status !== 'reversed' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenEdit(r)}
              style={{ height: 30, padding: '0 0.5rem', color: 'var(--primary-color)' }}
              title={isAr ? 'تعديل القيد المحاسبي' : 'Edit entry'}
            >
              <Edit2 size={13} />
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => handleOpenDelete(r)}
            style={{ height: 30, padding: '0 0.5rem' }}
            title={isAr ? 'حذف القيد' : 'Delete entry'}
          >
            <Trash2 size={13} />
          </button>
          {r.status === 'posted' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenReverse(r)}
              style={{ height: 30, padding: '0 0.5rem', color: 'var(--color-danger)' }}
              title={isAr ? 'عكس القيد' : 'Reverse entry'}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/accounting`} className="btn-back" title={t.backToHub}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNewEntryNumber(`JE-MAN-${Date.now().toString().slice(-6)}`)
            setNewEntryDate(new Date().toISOString().split('T')[0])
            setNewCurrencyCode(defaultCurrency)
            setNewDisplayRate(1)
            setNewRateMode('USD_TO_CUR')
            setNewMultiCurrencyPerLine(false)
            setNewDescription('')
            setNewLines([
              { accountId: accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
              { accountId: accounts[1]?.id || accounts[0]?.id || '', description: '', currencyCode: defaultCurrency, effectiveRate: 1, debitAmount: 0, creditAmount: 0 },
            ])
            setIsNewModalOpen(true)
          }}
          id="new-journal-entry-btn"
        >
          <Plus size={16} />
          {t.newEntry}
        </button>
      </div>

      <DataTable
        data={entries}
        columns={columns}
        searchKey={(r) => `${r.entryNumber} ${r.description || ''} ${r.sourceType} ${r.currencyCode}`}
        searchPlaceholder={t.searchPlaceholder}
        statusKey={(r) => r.status}
        statusOptions={[
          { label: t.statuses.posted, value: 'posted' },
          { label: t.statuses.reversed, value: 'reversed' },
          { label: t.statuses.draft, value: 'draft' },
        ]}
      />

      {/* VIEW JOURNAL ENTRY MODAL */}
      {selectedEntry && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={t.viewTitle(selectedEntry.entryNumber)}
          maxWidth="900px"
        >
          <div style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div><strong>{t.date}:</strong> {formatDate(selectedEntry.entryDate)}</div>
              <div><strong>{t.status}:</strong> <span className="badge badge-success">{t.statuses[selectedEntry.status as keyof typeof t.statuses] || selectedEntry.status}</span></div>
              <div><strong>{t.source}:</strong> <span className="badge badge-secondary">{selectedEntry.sourceType}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong>{t.currency}:</strong>
                <span className="badge badge-primary">{selectedEntry.currencyCode}</span>
                {selectedEntry.currencyCode !== defaultCurrency && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ({formatExchangeRateDisplay(selectedEntry.currencyCode, Number(selectedEntry.exchangeRate) || 1, defaultCurrency)})
                  </span>
                )}
              </div>
            </div>
            {selectedEntry.description && (
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                <strong>{t.description}:</strong> {selectedEntry.description}
              </div>
            )}
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.account}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.memo}</th>
                  <th style={{ padding: '0.625rem 0.75rem', fontSize: '0.75rem', textAlign: 'center' }}>{t.currency}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.debit}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.credit}</th>
                  {selectedEntry.currencyCode !== defaultCurrency && (
                    <>
                      <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.baseDebit}</th>
                      <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.baseCredit}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {selectedEntry.lines.map((l) => {
                  const lineCurrency = l.currencyCode || selectedEntry.currencyCode
                  const lineRate = Number(l.exchangeRate) || Number(selectedEntry.exchangeRate) || 1
                  const baseDeb = Number(l.baseDebit) || Number(l.debitAmount) * lineRate
                  const baseCred = Number(l.baseCredit) || Number(l.creditAmount) * lineRate

                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>
                        {l.accountCode} - {l.accountName}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {l.description || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.8125rem', textAlign: 'center' }}>
                        <span className="badge badge-secondary">{lineCurrency}</span>
                        {lineCurrency !== defaultCurrency && lineRate !== 1 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {formatExchangeRateDisplay(lineCurrency, lineRate, defaultCurrency)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: l.debitAmount > 0 ? 700 : 400, color: l.debitAmount > 0 ? 'var(--color-brand-600)' : 'inherit' }}>
                        {l.debitAmount > 0 ? formatCurrency(l.debitAmount, lineCurrency) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: l.creditAmount > 0 ? 700 : 400, color: l.creditAmount > 0 ? 'var(--color-warning-text)' : 'inherit' }}>
                        {l.creditAmount > 0 ? formatCurrency(l.creditAmount, lineCurrency) : '—'}
                      </td>
                      {selectedEntry.currencyCode !== defaultCurrency && (
                        <>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: baseDeb > 0 ? 600 : 400, color: 'var(--text-secondary)' }}>
                            {baseDeb > 0 ? formatCurrency(baseDeb, defaultCurrency) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: baseCred > 0 ? 600 : 400, color: 'var(--text-secondary)' }}>
                            {baseCred > 0 ? formatCurrency(baseCred, defaultCurrency) : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-page)', fontWeight: 700 }}>
                  <td colSpan={selectedEntry.currencyCode !== defaultCurrency ? 5 : 3} style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {isAr ? 'الإجمالي المتوازن بالعملة الأساسية:' : 'Total Balanced in Base Currency:'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--color-brand-600)' }}>
                    {formatCurrency(
                      selectedEntry.lines.reduce((acc, l) => acc + (Number(l.baseDebit) || Number(l.debitAmount) * (Number(l.exchangeRate) || 1)), 0),
                      defaultCurrency
                    )}
                  </td>
                  {selectedEntry.currencyCode !== defaultCurrency && (
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--color-warning-text)' }}>
                      {formatCurrency(
                        selectedEntry.lines.reduce((acc, l) => acc + (Number(l.baseCredit) || Number(l.creditAmount) * (Number(l.exchangeRate) || 1)), 0),
                        defaultCurrency
                      )}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      {/* REVERSE MODAL */}
      {selectedEntry && (
        <Modal
          isOpen={isReverseModalOpen}
          onClose={() => setIsReverseModalOpen(false)}
          title={t.reverseTitle(selectedEntry.entryNumber)}
        >
          <form onSubmit={handleExecuteReversal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {isAr
                ? 'سيؤدي عكس القيد إلى إنشاء وترحيل قيد معاكس لتبديل المدين والدائن بنفس العملات وأسعار الصرف مع الحفاظ على سجل التدقيق الكامل.'
                : 'Reversing an entry will post an inverse entry with debits and credits swapped in the same currency.'}
            </p>

            <div>
              <label className="form-label required">
                {isAr ? 'سبب عكس القيد' : 'Reason for Reversal'}
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder={isAr ? 'مثال: تصحيح خطأ في القيد المحاسبي' : 'e.g. Correcting accounting entry error'}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsReverseModalOpen(false)}>
                {t.cancel}
              </button>
              <button type="submit" className="btn btn-danger" disabled={loading}>
                {loading ? t.reversing : t.reverseBtn}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* NEW JOURNAL ENTRY MODAL */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title={t.postManualTitle}
        subtitle={t.postManualSub}
        maxWidth="960px"
      >
        <form onSubmit={handleCreateNewEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Parameters Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div>
              <label className="form-label required">{t.entryNumber}</label>
              <input
                type="text"
                className="form-control"
                value={newEntryNumber}
                onChange={(e) => setNewEntryNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">{t.date}</label>
              <input
                type="date"
                className="form-control"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
                required
              />
            </div>

            {/* Currency Selector */}
            <div>
              <label className="form-label required" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Coins size={14} style={{ color: 'var(--color-brand-600)' }} />
                {t.currency}
              </label>
              <select
                className="form-control"
                value={newCurrencyCode}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Exchange Rate Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label required" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowRightLeft size={14} style={{ color: 'var(--color-brand-600)' }} />
                  {newRateMode === 'USD_TO_CUR'
                    ? (isAr ? `سعر الدولار (1 ${defaultCurrency} = ? ${newCurrencyCode})` : `1 ${defaultCurrency} = ? ${newCurrencyCode}`)
                    : (isAr ? `سعر العملة (1 ${newCurrencyCode} = ? ${defaultCurrency})` : `1 ${newCurrencyCode} = ? ${defaultCurrency}`)}
                </label>

                {newCurrencyCode !== defaultCurrency && (
                  <button
                    type="button"
                    onClick={handleToggleRateMode}
                    className="btn btn-secondary btn-sm"
                    style={{ height: 22, padding: '0 0.35rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    title={isAr ? 'عكس اتجاه عرض سعر الصرف' : 'Invert quotation direction'}
                  >
                    ⇄
                  </button>
                )}
              </div>

              <input
                type="number"
                step="0.0001"
                min="0.000001"
                className="form-control"
                value={newDisplayRate}
                disabled={newCurrencyCode === defaultCurrency}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 1
                  setNewDisplayRate(rate)
                  const eff = newCurrencyCode === defaultCurrency ? 1 : newRateMode === 'USD_TO_CUR' ? (rate > 0 ? 1 / rate : 1) : rate
                  setNewLines((prev) =>
                    prev.map((l) => (l.currencyCode === newCurrencyCode ? { ...l, effectiveRate: eff } : l))
                  )
                }}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                {newCurrencyCode === defaultCurrency
                  ? (isAr ? 'العملة الأساسية للنظام' : 'Base System Currency')
                  : newRateMode === 'USD_TO_CUR'
                  ? `1 ${defaultCurrency} = ${newDisplayRate} ${newCurrencyCode} (1 ${newCurrencyCode} ≈ ${(1 / newDisplayRate).toFixed(6)} ${defaultCurrency})`
                  : `1 ${newCurrencyCode} = ${newDisplayRate} ${defaultCurrency} (1 ${defaultCurrency} ≈ ${(1 / newDisplayRate).toFixed(4)} ${newCurrencyCode})`}
              </span>
            </div>
          </div>

          <div>
            <label className="form-label">{t.description}</label>
            <input
              type="text"
              className="form-control"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={isAr ? 'مثال: القيد الافتتاحي أو تسوية الحسابات أو دفع مستحقات بالعملة الأجنبية' : 'e.g. Opening balance, settlement or foreign currency adjustment'}
            />
          </div>

          {/* Line items Section */}
          <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isAr ? `بنود القيد (${newLines.length} أسطر)` : `Journal Lines (${newLines.length} Lines)`}
                </span>
                <span className="badge badge-secondary">{isAr ? 'قيد مزدوج' : 'Double-Entry'}</span>
                {newCurrencyCode !== defaultCurrency && (
                  <span className="badge badge-warning">
                    {newCurrencyCode} ({newRateMode === 'USD_TO_CUR' ? `1 ${defaultCurrency} = ${newDisplayRate} ${newCurrencyCode}` : `1 ${newCurrencyCode} = ${newDisplayRate} ${defaultCurrency}`})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', marginInlineEnd: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={newMultiCurrencyPerLine}
                    onChange={(e) => setNewMultiCurrencyPerLine(e.target.checked)}
                  />
                  <span>{t.perLineCurrency}</span>
                </label>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoBalance}
                  title={t.autoBalance}
                  style={{ fontSize: '0.75rem', height: 28 }}
                >
                  {t.autoBalance}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddLine}
                  id="add-journal-line-btn"
                  style={{ fontSize: '0.75rem', height: 28 }}
                >
                  <Plus size={13} />
                  {t.addLine}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '360px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: newMultiCurrencyPerLine ? '28%' : '34%' }}>{t.account}</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: newMultiCurrencyPerLine ? '22%' : '28%' }}>{t.memo}</th>
                    {newMultiCurrencyPerLine && (
                      <th style={{ padding: '0.5rem 0.5rem', fontSize: '0.75rem', width: '18%' }}>{t.currency} / {t.rate}</th>
                    )}
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: '16%' }}>{t.debit} ({newCurrencyCode})</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: '16%' }}>{t.credit} ({newCurrencyCode})</th>
                    <th style={{ padding: '0.5rem 0.5rem', fontSize: '0.75rem', width: '5%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {newLines.map((l, idx) => {
                    const lineBaseDebit = (Number(l.debitAmount) || 0) * (Number(l.effectiveRate) || 1)
                    const lineBaseCredit = (Number(l.creditAmount) || 0) * (Number(l.effectiveRate) || 1)

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem 0.625rem', minWidth: '200px' }}>
                          <AccountSearchSelect
                            accounts={accounts}
                            value={l.accountId}
                            onChange={(val) => {
                              setNewLines((prev) => {
                                const n = [...prev]
                                n[idx].accountId = val
                                return n
                              })
                            }}
                            placeholder={t.searchAccountPlaceholder}
                            required
                          />
                        </td>

                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={newDescription || `${t.memo} #${idx + 1}`}
                            value={l.description}
                            onChange={(e) => {
                              const val = e.target.value
                              setNewLines((prev) => {
                                const n = [...prev]
                                n[idx].description = val
                                return n
                              })
                            }}
                            style={{ fontSize: '0.8125rem', padding: '0.45rem 0.625rem' }}
                          />
                        </td>

                        {newMultiCurrencyPerLine && (
                          <td style={{ padding: '0.5rem 0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <select
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem', width: '70px' }}
                                value={l.currencyCode}
                                onChange={(e) => {
                                  const cur = e.target.value
                                  const { displayRate, mode } = getSuggestedRateInfo(cur)
                                  const eff = cur === defaultCurrency ? 1 : mode === 'USD_TO_CUR' ? (displayRate > 0 ? 1 / displayRate : 1) : displayRate
                                  setNewLines((prev) => {
                                    const n = [...prev]
                                    n[idx].currencyCode = cur
                                    n[idx].effectiveRate = eff
                                    return n
                                  })
                                }}
                              >
                                {availableCurrencies.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.code}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.0001"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem', width: '65px' }}
                                value={l.effectiveRate < 1 ? Number((1 / l.effectiveRate).toFixed(2)) : l.effectiveRate}
                                title={l.effectiveRate < 1 ? `1 ${defaultCurrency} = ${(1 / l.effectiveRate).toFixed(2)} ${l.currencyCode}` : `1 ${l.currencyCode} = ${l.effectiveRate} ${defaultCurrency}`}
                                onChange={(e) => {
                                  const r = parseFloat(e.target.value) || 1
                                  // if value is > 1 (e.g. 48.70 for TRY), treat as USD_TO_CUR
                                  const eff = r > 1 && l.currencyCode !== 'EUR' && l.currencyCode !== 'GBP' && l.currencyCode !== 'KWD' ? 1 / r : r
                                  setNewLines((prev) => {
                                    const n = [...prev]
                                    n[idx].effectiveRate = eff
                                    return n
                                  })
                                }}
                              />
                            </div>
                          </td>
                        )}

                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={l.debitAmount === 0 ? '' : l.debitAmount}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value)
                              setNewLines((prev) => {
                                const n = [...prev]
                                n[idx].debitAmount = val
                                if (val > 0) n[idx].creditAmount = 0
                                return n
                              })
                            }}
                            style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 0.625rem' }}
                          />
                          {(l.effectiveRate !== 1 || l.currencyCode !== defaultCurrency) && l.debitAmount > 0 && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'right' }}>
                              ≈ {formatCurrency(lineBaseDebit, defaultCurrency)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={l.creditAmount === 0 ? '' : l.creditAmount}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value)
                              setNewLines((prev) => {
                                const n = [...prev]
                                n[idx].creditAmount = val
                                if (val > 0) n[idx].debitAmount = 0
                                return n
                              })
                            }}
                            style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 0.625rem' }}
                          />
                          {(l.effectiveRate !== 1 || l.currencyCode !== defaultCurrency) && l.creditAmount > 0 && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'right' }}>
                              ≈ {formatCurrency(lineBaseCredit, defaultCurrency)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={newLines.length <= 2}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: newLines.length <= 2 ? '#cbd5e1' : '#ef4444',
                              cursor: newLines.length <= 2 ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={newLines.length <= 2 ? 'At least 2 lines required' : 'Remove line'}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Balance Summary & IAS 21 Validation Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isBalanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1.5px solid ${isBalanced ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              padding: '0.875rem 1.25rem',
              borderRadius: '10px',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {t.totalBaseDebits} ({defaultCurrency})
                </span>
                <strong style={{ fontSize: '1.0625rem', color: 'var(--color-brand-600)' }}>
                  {formatCurrency(totalDebitsBase, defaultCurrency)}
                </strong>
                {newCurrencyCode !== defaultCurrency && !newMultiCurrencyPerLine && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ({formatCurrency(totalDebitsOriginal, newCurrencyCode)})
                  </div>
                )}
              </div>

              <div style={{ borderLeft: '1px solid var(--border-color)', height: '28px' }} />

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {t.totalBaseCredits} ({defaultCurrency})
                </span>
                <strong style={{ fontSize: '1.0625rem', color: 'var(--color-warning-text)' }}>
                  {formatCurrency(totalCreditsBase, defaultCurrency)}
                </strong>
                {newCurrencyCode !== defaultCurrency && !newMultiCurrencyPerLine && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ({formatCurrency(totalCreditsOriginal, newCurrencyCode)})
                  </div>
                )}
              </div>

              {!isBalanced && (
                <>
                  <div style={{ borderLeft: '1px solid var(--border-color)', height: '28px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', display: 'block' }}>
                      {t.diff} ({defaultCurrency})
                    </span>
                    <strong style={{ fontSize: '1.0625rem', color: 'var(--color-danger)' }}>
                      {formatCurrency(differenceBase, defaultCurrency)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isBalanced ? (
                <span className="badge badge-success" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}>
                  {t.balanced}
                </span>
              ) : (
                <span className="badge badge-danger" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}>
                  {t.unbalanced}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewModalOpen(false)} disabled={loading}>
              {t.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isBalanced}
              id="post-journal-entry-submit-btn"
            >
              {loading ? t.posting : t.postEntry}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT JOURNAL ENTRY MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingEntry(null)
        }}
        title={t.editTitle(editingEntry?.entryNumber || '')}
        maxWidth="960px"
      >
        <form onSubmit={handleExecuteUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div>
              <label className="form-label required">{t.entryNumber}</label>
              <input
                type="text"
                className="form-control"
                value={editingEntry?.entryNumber || ''}
                disabled
                style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
              />
            </div>

            <div>
              <label className="form-label required">{t.date}</label>
              <input
                type="date"
                className="form-control"
                value={editEntryDate}
                onChange={(e) => setEditEntryDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">{t.currency}</label>
              <select
                className="form-control"
                value={editCurrencyCode}
                onChange={(e) => handleEditCurrencyChange(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label required" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {editRateMode === 'USD_TO_CUR'
                    ? (isAr ? `سعر الدولار (1 ${defaultCurrency} = ? ${editCurrencyCode})` : `1 ${defaultCurrency} = ? ${editCurrencyCode}`)
                    : (isAr ? `سعر العملة (1 ${editCurrencyCode} = ? ${defaultCurrency})` : `1 ${editCurrencyCode} = ? ${defaultCurrency}`)}
                </label>
                {editCurrencyCode !== defaultCurrency && (
                  <button
                    type="button"
                    onClick={handleToggleEditRateMode}
                    className="btn btn-secondary btn-sm"
                    style={{ height: 22, padding: '0 0.35rem', fontSize: '0.7rem' }}
                    title={isAr ? 'عكس اتجاه سعر الصرف' : 'Invert rate direction'}
                  >
                    ⇄
                  </button>
                )}
              </div>

              <input
                type="number"
                step="0.0001"
                min="0.000001"
                className="form-control"
                value={editDisplayRate}
                disabled={editCurrencyCode === defaultCurrency}
                onChange={(e) => {
                  const r = parseFloat(e.target.value) || 1
                  setEditDisplayRate(r)
                  const eff = editCurrencyCode === defaultCurrency ? 1 : editRateMode === 'USD_TO_CUR' ? (r > 0 ? 1 / r : 1) : r
                  setEditLines((prev) =>
                    prev.map((l) => (l.currencyCode === editCurrencyCode ? { ...l, effectiveRate: eff } : l))
                  )
                }}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                {editCurrencyCode === defaultCurrency
                  ? (isAr ? 'العملة الأساسية للنظام' : 'Base System Currency')
                  : editRateMode === 'USD_TO_CUR'
                  ? `1 ${defaultCurrency} = ${editDisplayRate} ${editCurrencyCode} (1 ${editCurrencyCode} ≈ ${(1 / editDisplayRate).toFixed(6)} ${defaultCurrency})`
                  : `1 ${editCurrencyCode} = ${editDisplayRate} ${defaultCurrency} (1 ${defaultCurrency} ≈ ${(1 / editDisplayRate).toFixed(4)} ${editCurrencyCode})`}
              </span>
            </div>
          </div>

          <div>
            <label className="form-label">{t.description}</label>
            <input
              type="text"
              className="form-control"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder={isAr ? 'مثال: تسوية حسابات، إثبات مبيعات، قيد تصحيحي...' : 'e.g. Account settlement, adjustment...'}
            />
          </div>

          {/* Lines Table */}
          <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} style={{ color: 'var(--color-brand-600)' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  {isAr ? `أطراف القيد المحاسبي (${editLines.length})` : `Journal Lines (${editLines.length})`}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', marginInlineEnd: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editMultiCurrencyPerLine}
                    onChange={(e) => setEditMultiCurrencyPerLine(e.target.checked)}
                  />
                  <span>{t.perLineCurrency}</span>
                </label>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoBalanceEdit}
                  title={t.autoBalance}
                  style={{ fontSize: '0.75rem', height: 28 }}
                >
                  {t.autoBalance}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddEditLine}
                  style={{ fontSize: '0.75rem', height: 28 }}
                >
                  <Plus size={13} />
                  {t.addLine}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '340px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: editMultiCurrencyPerLine ? '28%' : '34%' }}>{t.account}</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: editMultiCurrencyPerLine ? '22%' : '28%' }}>{t.memo}</th>
                    {editMultiCurrencyPerLine && (
                      <th style={{ padding: '0.5rem 0.5rem', fontSize: '0.75rem', width: '18%' }}>{t.currency} / {t.rate}</th>
                    )}
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: '16%' }}>{t.debit} ({editCurrencyCode})</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: '16%' }}>{t.credit} ({editCurrencyCode})</th>
                    <th style={{ padding: '0.5rem 0.5rem', fontSize: '0.75rem', width: '5%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editLines.map((line, idx) => {
                    const lineBaseDebit = (Number(line.debitAmount) || 0) * (Number(line.effectiveRate) || 1)
                    const lineBaseCredit = (Number(line.creditAmount) || 0) * (Number(line.effectiveRate) || 1)

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem 0.625rem', minWidth: '200px' }}>
                          <AccountSearchSelect
                            accounts={accounts}
                            value={line.accountId}
                            onChange={(accId) => {
                              const updated = [...editLines]
                              updated[idx].accountId = accId
                              setEditLines(updated)
                            }}
                            placeholder={t.searchAccountPlaceholder}
                            required
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: '0.8125rem', padding: '0.45rem 0.625rem' }}
                            value={line.description}
                            onChange={(e) => {
                              const updated = [...editLines]
                              updated[idx].description = e.target.value
                              setEditLines(updated)
                            }}
                            placeholder={isAr ? 'بيان اختياري للسطر...' : 'Optional line memo...'}
                          />
                        </td>

                        {editMultiCurrencyPerLine && (
                          <td style={{ padding: '0.5rem 0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <select
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem', width: '70px' }}
                                value={line.currencyCode}
                                onChange={(e) => {
                                  const cur = e.target.value
                                  const { displayRate, mode } = getSuggestedRateInfo(cur)
                                  const eff = cur === defaultCurrency ? 1 : mode === 'USD_TO_CUR' ? (displayRate > 0 ? 1 / displayRate : 1) : displayRate
                                  const updated = [...editLines]
                                  updated[idx].currencyCode = cur
                                  updated[idx].effectiveRate = eff
                                  setEditLines(updated)
                                }}
                              >
                                {availableCurrencies.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.code}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.0001"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem', width: '65px' }}
                                value={line.effectiveRate < 1 ? Number((1 / line.effectiveRate).toFixed(2)) : line.effectiveRate}
                                title={line.effectiveRate < 1 ? `1 ${defaultCurrency} = ${(1 / line.effectiveRate).toFixed(2)} ${line.currencyCode}` : `1 ${line.currencyCode} = ${line.effectiveRate} ${defaultCurrency}`}
                                onChange={(e) => {
                                  const r = parseFloat(e.target.value) || 1
                                  const eff = r > 1 && line.currencyCode !== 'EUR' && line.currencyCode !== 'GBP' && line.currencyCode !== 'KWD' ? 1 / r : r
                                  const updated = [...editLines]
                                  updated[idx].effectiveRate = eff
                                  setEditLines(updated)
                                }}
                              />
                            </div>
                          </td>
                        )}

                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 0.625rem' }}
                            value={line.debitAmount === 0 ? '' : line.debitAmount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value)
                              const updated = [...editLines]
                              updated[idx].debitAmount = val
                              if (val > 0) updated[idx].creditAmount = 0
                              setEditLines(updated)
                            }}
                            placeholder="0.00"
                          />
                          {(line.effectiveRate !== 1 || line.currencyCode !== defaultCurrency) && line.debitAmount > 0 && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'right' }}>
                              ≈ {formatCurrency(lineBaseDebit, defaultCurrency)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0.5rem 0.625rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.45rem 0.625rem' }}
                            value={line.creditAmount === 0 ? '' : line.creditAmount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value)
                              const updated = [...editLines]
                              updated[idx].creditAmount = val
                              if (val > 0) updated[idx].debitAmount = 0
                              setEditLines(updated)
                            }}
                            placeholder="0.00"
                          />
                          {(line.effectiveRate !== 1 || line.currencyCode !== defaultCurrency) && line.creditAmount > 0 && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'right' }}>
                              ≈ {formatCurrency(lineBaseCredit, defaultCurrency)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditLine(idx)}
                            disabled={editLines.length <= 2}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: editLines.length <= 2 ? '#cbd5e1' : '#ef4444',
                              cursor: editLines.length <= 2 ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={editLines.length <= 2 ? 'At least 2 lines required' : 'Remove line'}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Balance Summary Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isEditBalanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1.5px solid ${isEditBalanced ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              padding: '0.875rem 1.25rem',
              borderRadius: '10px',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {t.totalBaseDebits} ({defaultCurrency})
                </span>
                <strong style={{ fontSize: '1.0625rem', color: 'var(--color-brand-600)' }}>
                  {formatCurrency(editTotalDebitsBase, defaultCurrency)}
                </strong>
              </div>

              <div style={{ borderLeft: '1px solid var(--border-color)', height: '28px' }} />

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {t.totalBaseCredits} ({defaultCurrency})
                </span>
                <strong style={{ fontSize: '1.0625rem', color: 'var(--color-warning-text)' }}>
                  {formatCurrency(editTotalCreditsBase, defaultCurrency)}
                </strong>
              </div>

              {!isEditBalanced && (
                <>
                  <div style={{ borderLeft: '1px solid var(--border-color)', height: '28px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', display: 'block' }}>
                      {t.diff} ({defaultCurrency})
                    </span>
                    <strong style={{ fontSize: '1.0625rem', color: 'var(--color-danger)' }}>
                      {formatCurrency(editDifferenceBase, defaultCurrency)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isEditBalanced ? (
                <span className="badge badge-success" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}>
                  {t.balanced}
                </span>
              ) : (
                <span className="badge badge-danger" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}>
                  {t.unbalanced}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingEntry(null)
              }}
              disabled={loading}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isEditBalanced}
            >
              {loading ? t.saving : t.saveChanges}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE JOURNAL ENTRY MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDeletingEntry(null)
        }}
        title={t.deleteTitle}
      >
        {deletingEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--border-radius)',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={28} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.875rem' }}>
                {isAr ? (
                  <>هل أنت متأكد من رغبتك في حذف القيد المحاسبي رقم <strong>&quot;{deletingEntry.entryNumber}&quot;</strong>؟</>
                ) : (
                  <>Are you sure you want to delete journal entry <strong>&quot;{deletingEntry.entryNumber}&quot;</strong>?</>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '0.875rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                fontSize: '0.825rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div><strong>{t.date}:</strong> {formatDate(deletingEntry.entryDate)}</div>
              <div><strong>{t.description}:</strong> {deletingEntry.description || '—'}</div>
              <div><strong>{t.status}:</strong> {t.statuses[deletingEntry.status as keyof typeof t.statuses] || deletingEntry.status}</div>
              <div>
                <strong>{isAr ? 'إجمالي القيمة:' : 'Total Amount:'}</strong>{' '}
                {formatCurrency(
                  deletingEntry.lines.reduce((acc, l) => acc + (Number(l.baseDebit) || Number(l.debitAmount) * (Number(l.exchangeRate) || 1)), 0),
                  defaultCurrency
                )}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isAr
                ? '⚠️ سيتم حذف القيد وبنوده بالكامل من دفتر اليومية والأستاذ العام وتحديث أرصدة الحسابات تلقائياً.'
                : '⚠️ This journal entry will be permanently deleted and all account balances automatically recomputed.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeletingEntry(null)
                }}
                disabled={loading}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                onClick={handleExecuteDelete}
                disabled={loading}
              >
                {loading ? t.deleting : t.deleteBtn}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
