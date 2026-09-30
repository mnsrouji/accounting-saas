'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  CheckCheck,
  Landmark,
  Plus,
  Play,
  Unlink,
  Link as LinkIcon,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Info,
  Calendar,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/decimal'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import {
  createReconciliationSessionAction,
  autoMatchTransactionsAction,
  matchTransactionsManuallyAction,
  unmatchTransactionAction,
  postReconciliationAdjustmentAction,
  closeReconciliationPeriodAction,
  reopenReconciliationPeriodAction,
} from '@/actions/treasury/treasury-actions'

interface BankAccountOption {
  id: string
  name: string
  bankName: string
  accountNumber: string
  currency: string
  balance: number
  glAccountCode: string
}

interface ReconciliationSession {
  id: string
  reconciliationNumber: string
  statementDate: string
  statementBalance: number
  bookBalance: number
  clearedBalance: number
  difference: number
  status: string
  reconciledAt: string | null
  notes: string | null
}

interface StatementLineItem {
  id: string
  date: string
  valueDate: string | null
  description: string
  reference: string | null
  amount: number
  type: string
  externalTxnId: string | null
  isMatched: boolean
  matchId: string | null
}

interface BookTxnItem {
  id: string
  type: string
  amount: number
  date: string
  description: string
  reference: string | null
  isMatched: boolean
  matchId: string | null
}

interface MatchPair {
  id: string
  matchType: string
  statementLineId: string
  statementLineDesc: string
  statementLineAmount: number
  bankTransactionId: string
  bankTxnDesc: string
  bankTxnAmount: number
  matchedAt: string
}

interface AdjustmentItem {
  id: string
  reason: string
  amount: number
  glAccountId: string
  glAccountCode: string
  glAccountName: string
  date: string
  notes: string | null
}

interface BankReconciliationClientProps {
  businessId: string
  defaultCurrency: string
  selectedBankAccountId: string
  bankAccounts: BankAccountOption[]
  reconciliation: ReconciliationSession | null
  statementLines: StatementLineItem[]
  bookTransactions: BookTxnItem[]
  matches: MatchPair[]
  adjustments: AdjustmentItem[]
  glAccounts: Array<{ id: string; code: string; name: string; type: string }>
}

export function BankReconciliationClient({
  businessId,
  defaultCurrency,
  selectedBankAccountId,
  bankAccounts,
  reconciliation,
  statementLines,
  bookTransactions,
  matches,
  adjustments,
  glAccounts,
}: BankReconciliationClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [loading, setLoading] = useState(false)

  // Selection states for manual matching
  const [selectedStatementLineId, setSelectedStatementLineId] = useState<string | null>(null)
  const [selectedBookTxnId, setSelectedBookTxnId] = useState<string | null>(null)

  // Modal states
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [isAutoMatchModalOpen, setIsAutoMatchModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false)

  // New session form
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [statementBalance, setStatementBalance] = useState('')

  // Auto match options
  const [dateToleranceDays, setDateToleranceDays] = useState('3')
  const [matchReference, setMatchReference] = useState(true)

  // Adjustment form
  const [adjReason, setAdjReason] = useState<'bank_fee' | 'interest_income' | 'interest_expense' | 'bank_charge' | 'timing_difference' | 'other'>('bank_fee')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjGlAccountId, setAdjGlAccountId] = useState(glAccounts[0]?.id || '')
  const [adjDate, setAdjDate] = useState(new Date().toISOString().slice(0, 10))
  const [adjNotes, setAdjNotes] = useState('')

  // Reopen form
  const [reopenReason, setReopenReason] = useState('')

  const activeAccount = bankAccounts.find((b) => b.id === selectedBankAccountId)
  const currency = activeAccount?.currency || defaultCurrency

  const isClosed = reconciliation?.status === 'closed'

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/b/${businessId}/treasury/reconciliation?bankAccountId=${e.target.value}`)
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBankAccountId || !statementBalance) {
      toast.error(isAr ? 'رصيد كشف الحساب مطلوب' : isTr ? 'Ekstre bakiyesi zorunludur' : 'Statement balance is required')
      return
    }

    setLoading(true)
    try {
      const res = await createReconciliationSessionAction(businessId, {
        bankAccountId: selectedBankAccountId,
        statementDate: new Date(sessionDate),
        statementBalance: parseFloat(statementBalance),
      })

      if (res.success) {
        toast.success(isAr ? 'تم إنشاء جلسة التسوية البنكية بنجاح!' : isTr ? 'Mutabakat oturumu oluşturuldu!' : 'Reconciliation session created!')
        setIsSessionModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل إنشاء جلسة التسوية' : isTr ? 'Oturum oluşturulamadı' : 'Failed to create session'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleAutoMatch = async () => {
    if (!reconciliation) return
    setLoading(true)
    try {
      const res = await autoMatchTransactionsAction(businessId, reconciliation.id, {
        dateToleranceDays: parseInt(dateToleranceDays) || 3,
        matchReference,
        matchDescription: true,
      })

      if (res.success) {
        const count = (res.result as any)?.matchedCount || 0
        toast.success(
          isAr
            ? `اكتملت المطابقة الآلية! تم مطابقة ${count} حركة بنجاح.`
            : isTr
            ? `Otomatik eşleştirme tamamlandı! ${count} işlem eşleştirildi.`
            : `Auto-matching complete! Matched ${count} transaction(s).`
        )
        setIsAutoMatchModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشلت المطابقة الآلية' : isTr ? 'Otomatik eşleştirme başarısız' : 'Auto-match failed'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleManualMatch = async () => {
    if (!reconciliation || !selectedStatementLineId || !selectedBookTxnId) return
    setLoading(true)
    try {
      const res = await matchTransactionsManuallyAction(businessId, {
        reconciliationId: reconciliation.id,
        statementLineId: selectedStatementLineId,
        bankTransactionId: selectedBookTxnId,
        matchType: 'manual',
      })

      if (res.success) {
        toast.success(isAr ? 'تم مطابقة الحركتين يدوياً بنجاح!' : isTr ? 'İşlemler başarıyla eşleştirildi!' : 'Transactions successfully matched!')
        setSelectedStatementLineId(null)
        setSelectedBookTxnId(null)
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل مطابقة الحركتين' : isTr ? 'İşlemler eşleştirilemedi' : 'Failed to match transactions'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleUnmatch = async (matchId: string) => {
    if (!reconciliation) return
    setLoading(true)
    try {
      const res = await unmatchTransactionAction(businessId, reconciliation.id, matchId)
      if (res.success) {
        toast.success(isAr ? 'تم إلغاء المطابقة بنجاح' : isTr ? 'Eşleştirme başarıyla kaldırıldı' : 'Transaction unmatched successfully')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل إلغاء المطابقة' : isTr ? 'Eşleştirme kaldırılamadı' : 'Failed to unmatch'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handlePostAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reconciliation || !adjAmount || parseFloat(adjAmount) <= 0) {
      toast.error(isAr ? 'يجب إدخال مبلغ صحيح أكبر من الصفر' : isTr ? 'Geçerli pozitif bir tutar gereklidir' : 'Valid positive amount is required')
      return
    }
    if (!adjGlAccountId) {
      toast.error(isAr ? 'حساب الدليل مطلوب' : isTr ? 'Muhasebe hesabı zorunludur' : 'GL Account is required')
      return
    }

    setLoading(true)
    try {
      const res = await postReconciliationAdjustmentAction(businessId, {
        reconciliationId: reconciliation.id,
        reason: adjReason,
        amount: parseFloat(adjAmount),
        glAccountId: adjGlAccountId,
        date: new Date(adjDate),
        notes: adjNotes.trim() || undefined,
      })

      if (res.success) {
        toast.success(
          isAr
            ? 'تم إنشاء التسوية وترحيل قيد يومية متوازن إلى دفتر الأستاذ العام!'
            : isTr
            ? 'Düzeltme oluşturuldu ve büyük deftere yevmiye kaydı işlendi!'
            : 'Adjustment created and balanced journal entry posted to General Ledger!'
        )
        setIsAdjustmentModalOpen(false)
        setAdjAmount('')
        setAdjNotes('')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل ترحيل التسوية' : isTr ? 'Düzeltme işlenemedi' : 'Failed to post adjustment'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleClosePeriod = async () => {
    if (!reconciliation) return
    if (reconciliation.difference !== 0) {
      const warnMsg = isAr
        ? `تحذير: يوجد فارق تسوية بمقدار ${formatCurrency(reconciliation.difference, currency)}. هل أنت متأكد من الإغلاق؟`
        : isTr
        ? `Uyarı: Mutabakat farkı ${formatCurrency(reconciliation.difference, currency)}. Dönemi kapatmak istediğinize emin misiniz?`
        : `Warning: Reconciliation difference is ${formatCurrency(reconciliation.difference, currency)}. Are you sure you want to close?`
      if (!confirm(warnMsg)) {
        return
      }
    }

    setLoading(true)
    try {
      const res = await closeReconciliationPeriodAction(businessId, reconciliation.id)
      if (res.success) {
        toast.success(
          isAr
            ? 'تم إغلاق وقفل فترة التسوية البنكية بنجاح!'
            : isTr
            ? 'Mutabakat dönemi başarıyla kapatıldı ve kilitlendi!'
            : 'Reconciliation period closed and locked successfully!'
        )
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل إغلاق الفترة' : isTr ? 'Dönem kapatılamadı' : 'Failed to close period'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleReopenPeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reconciliation || !reopenReason.trim() || reopenReason.trim().length < 5) {
      toast.error(isAr ? 'سبب إعادة الفتح يجب ألا يقل عن 5 أحرف' : isTr ? 'Yeniden açma gerekçesi en az 5 karakter olmalıdır' : 'Reopening justification must be at least 5 characters')
      return
    }

    setLoading(true)
    try {
      const res = await reopenReconciliationPeriodAction(businessId, reconciliation.id, reopenReason.trim())
      if (res.success) {
        toast.success(
          isAr
            ? 'تم إعادة فتح فترة التسوية وتوثيق العملية في سجل التدقيق الرقابي!'
            : isTr
            ? 'Mutabakat dönemi yeniden açıldı ve denetim günlüğüne kaydedildi!'
            : 'Reconciliation period reopened and logged to audit trail!'
        )
        setIsReopenModalOpen(false)
        setReopenReason('')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل إعادة فتح الفترة' : isTr ? 'Dönem yeniden açılamadı' : 'Failed to reopen period'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'bank_fee':
        return isAr ? 'رسوم وعمولات بنكية' : isTr ? 'Banka Masrafı / Hizmet Ücreti' : 'Bank Fee / Service Charge'
      case 'interest_income':
        return isAr ? 'فوائد / إيرادات بنكية' : isTr ? 'Faiz Geliri' : 'Interest Income'
      case 'interest_expense':
        return isAr ? 'فوائد مدينة / مصروفات تمويل' : isTr ? 'Faiz Gideri' : 'Interest Expense'
      case 'bank_charge':
        return isAr ? 'مصاريف مصرفية أخرى' : isTr ? 'Banka Gideri' : 'Bank Charge'
      case 'timing_difference':
        return isAr ? 'فروق توقيت وتحصيل' : isTr ? 'Zamanlama Farkı' : 'Timing Difference'
      default:
        return isAr ? 'تسوية أخرى معتمدة' : isTr ? 'Diğer Onaylı Düzeltme' : 'Other Approved Adjustment'
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isAr ? 'الخزينة' : isTr ? 'Hazine' : 'Treasury'}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>
              {isAr ? 'التسوية والمطابقة البنكية' : isTr ? 'Banka Mutabakatı' : 'Bank Reconciliation'}
            </span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCheck size={26} className="text-brand-600" />
            {isAr ? 'مساحة عمل التسوية والمطابقة البنكية' : isTr ? 'Banka Mutabakat Çalışma Alanı' : 'Bank Reconciliation Workspace'}
          </h1>
          <p className="page-subtitle">
            {isAr
              ? 'مطابقة كشوف الحسابات البنكية مع قيود دفتر الأستاذ العام، معالجة الفروقات، وإغلاق الفترات'
              : isTr
              ? 'Banka ekstrelerini büyük defter kayıtlarıyla eşleştirin, farkları giderin ve dönemleri kapatın'
              : 'Align bank statements with General Ledger journals, resolve differences, and close periods'}
          </p>
        </div>

        {/* Account Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Landmark size={16} className="text-brand-600" />
            <select
              value={selectedBankAccountId}
              onChange={handleAccountChange}
              style={{ border: 'none', fontWeight: 600, background: 'transparent', outline: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.bankName} - {b.currency})
                </option>
              ))}
            </select>
          </div>

          {!reconciliation && (
            <button className="btn btn-primary" onClick={() => setIsSessionModalOpen(true)}>
              <Plus size={16} />
              {isAr ? 'جلسة تسوية جديدة' : isTr ? 'Yeni Mutabakat Oturumu' : 'New Reconciliation Session'}
            </button>
          )}
        </div>
      </div>

      {/* Session Balance Header Card if Session Active */}
      {reconciliation ? (
        <div className="card" style={{ marginBottom: '1.5rem', [isAr ? 'borderRight' : 'borderLeft']: isClosed ? '4px solid #10b981' : '4px solid var(--color-brand-600)' }}>
          <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                    {isAr ? `جلسة #${reconciliation.reconciliationNumber}` : isTr ? `Oturum #${reconciliation.reconciliationNumber}` : `Session #${reconciliation.reconciliationNumber}`}
                  </span>
                  <span className={`badge ${isClosed ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {isClosed ? <Lock size={12} /> : <Unlock size={12} />}
                    {isClosed ? (isAr ? 'مغلقة ومقفلة' : isTr ? 'KAPALI' : 'CLOSED') : (isAr ? 'نشطة / جارية' : isTr ? 'AÇIK' : 'OPEN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {isAr ? 'تاريخ الكشف: ' : isTr ? 'Ekstre Tarihi: ' : 'Statement Date: '}
                  {new Date(reconciliation.statementDate).toLocaleDateString()}
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {!isClosed ? (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsAutoMatchModalOpen(true)} disabled={loading}>
                      <Play size={14} />
                      {isAr ? 'المطابقة الآلية' : isTr ? 'Otomatik Eşleştir' : 'Auto-Match Engine'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsAdjustmentModalOpen(true)} disabled={loading}>
                      <Receipt size={14} />
                      {isAr ? 'تسوية محاسبية معتمدة' : isTr ? 'Kontrollü Düzeltme' : 'Controlled Adjustment'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleClosePeriod} disabled={loading}>
                      <Lock size={14} />
                      {isAr ? 'إغلاق الفترة' : isTr ? 'Dönemi Kapat' : 'Close Period'}
                    </button>
                  </>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => setIsReopenModalOpen(true)} disabled={loading}>
                    <Unlock size={14} />
                    {isAr ? 'إعادة فتح الفترة (مدققة)' : isTr ? 'Dönemi Yeniden Aç (Denetimli)' : 'Reopen Period (Audited)'}
                  </button>
                )}
              </div>
            </div>

            {/* Balances Display */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isAr ? 'رصيد كشف الحساب البنكي' : isTr ? 'Hedef Ekstre Bakiyesi' : 'Target Statement Balance'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {formatCurrency(reconciliation.statementBalance, currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isAr ? 'رصيد الدفاتر (الأستاذ العام)' : isTr ? 'Defter Bakiyesi (GL)' : 'Current Book Balance (GL)'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {formatCurrency(reconciliation.bookBalance, currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isAr ? 'الرصيد المطابق / المسوى' : isTr ? 'Eşleşen Bakiye' : 'Cleared / Matched Balance'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>
                  {formatCurrency(reconciliation.clearedBalance, currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isAr ? 'الفارق / التباين' : isTr ? 'Fark / Uyuşmazlık' : 'Difference / Discrepancy'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: reconciliation.difference === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {reconciliation.difference === 0
                    ? (isAr ? '✓ متطابق تماماً ($0.00)' : isTr ? '✓ Dengeli ($0.00)' : '✓ Balanced ($0.00)')
                    : formatCurrency(reconciliation.difference, currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-brand-50)', color: 'var(--color-brand-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <CheckCheck size={24} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {isAr ? 'لا توجد جلسة تسوية بنكية نشطة' : isTr ? 'Aktif Mutabakat Oturumu Yok' : 'No Active Reconciliation Session'}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 1.5rem' }}>
            {isAr
              ? `ابدأ جلسة تسوية بنكية جديدة لحساب (${activeAccount?.name || 'هذا الحساب'}) لمطابقة بنود الكشف البنكي مع قيود اليومية.`
              : isTr
              ? `${activeAccount?.name || 'Bu banka hesabı'} için ekstre satırlarını defter kayıtlarıyla eşleştirmek üzere yeni bir mutabakat oturumu başlatın.`
              : `Start a new bank reconciliation session for ${activeAccount?.name || 'this bank account'} to match statement lines against ledger postings.`}
          </p>
          <button className="btn btn-primary" onClick={() => setIsSessionModalOpen(true)}>
            <Plus size={16} />
            {isAr ? 'بدء جلسة تسوية بنكية' : isTr ? 'Mutabakat Oturumu Başlat' : 'Start Reconciliation Session'}
          </button>
        </div>
      )}

      {/* Manual Match Bar */}
      {selectedStatementLineId && selectedBookTxnId && !isClosed && (
        <div style={{
          background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-700))',
          color: 'white',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
            <LinkIcon size={16} />
            {isAr
              ? 'تم تحديد حركة من كشف الحساب وحركة من الدفاتر للمطابقة اليدوية.'
              : isTr
              ? 'Manuel eşleştirme için 1 ekstre satırı ve 1 defter işlemi seçildi.'
              : '1 Statement Line and 1 Book Transaction selected for manual pairing.'}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleManualMatch} disabled={loading} style={{ background: 'white', color: 'var(--color-brand-700)', fontWeight: 700 }}>
            {isAr ? 'تأكيد المطابقة اليدوية' : isTr ? 'Manuel Eşleştirmeyi Onayla' : 'Confirm Manual Match'}
          </button>
        </div>
      )}

      {/* 2-Column Split Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Left Column: Bank Statement Lines */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={16} className="text-brand-600" />
              <span className="card-title">
                {isAr ? `بنود كشف الحساب البنكي (${statementLines.length})` : isTr ? `Banka Ekstre Satırları (${statementLines.length})` : `Bank Statement Lines (${statementLines.length})`}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isAr ? 'المصدر: التغذية البنكية' : isTr ? 'Kaynak: Banka Akışı' : 'Source: Electronic Bank Feed'}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 450, overflowY: 'auto' }}>
            {statementLines.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد بنود كشف حساب محملة لهذه الجلسة.' : isTr ? 'Bu oturum için ekstre satırı yüklenmedi.' : 'No statement lines loaded for this session.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'البيان / رقم المعاملة' : isTr ? 'Açıklama / İşlem No' : 'Description / Txn ID'}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الحالة' : isTr ? 'Durum' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLines.map((l) => {
                      const isSelected = selectedStatementLineId === l.id
                      return (
                        <tr
                          key={l.id}
                          style={{
                            background: isSelected ? 'var(--color-brand-50)' : undefined,
                            cursor: isClosed || l.isMatched ? 'default' : 'pointer',
                          }}
                          onClick={() => {
                            if (!isClosed && !l.isMatched) {
                              setSelectedStatementLineId(isSelected ? null : l.id)
                            }
                          }}
                        >
                          <td>
                            {!l.isMatched && !isClosed && (
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => setSelectedStatementLineId(isSelected ? null : l.id)}
                              />
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{new Date(l.date).toLocaleDateString()}</td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{l.description}</div>
                            {l.externalTxnId && <code style={{ fontSize: '0.7rem' }}>{l.externalTxnId}</code>}
                          </td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: l.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {l.type === 'credit' ? '+' : '-'}{formatCurrency(l.amount, currency)}
                          </td>
                          <td>
                            {l.isMatched ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                {isAr ? 'مطابق' : isTr ? 'Eşleşti' : 'Matched'}
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                {isAr ? 'غير مطابق' : isTr ? 'Eşleşmedi' : 'Unmatched'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Book / ERP Ledger Transactions */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={16} className="text-brand-600" />
              <span className="card-title">
                {isAr ? `حركات الدفاتر والأستاذ العام (${bookTransactions.length})` : isTr ? `Defter / ERP İşlemleri (${bookTransactions.length})` : `Book / ERP Transactions (${bookTransactions.length})`}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isAr ? 'المصدر: دفتر الأستاذ العام' : isTr ? 'Kaynak: Büyük Defter' : 'Source: General Ledger'}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 450, overflowY: 'auto' }}>
            {bookTransactions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد حركات دفترية مسجلة لهذا الحساب.' : isTr ? 'Bu hesap için defter işlemi kaydedilmedi.' : 'No book transactions recorded for this account.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'البيان / المرجع' : isTr ? 'Açıklama / Ref' : 'Description / Ref'}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الحالة' : isTr ? 'Durum' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookTransactions.map((t) => {
                      const isSelected = selectedBookTxnId === t.id
                      const isPositive = t.type.includes('deposit') || t.type.includes('income')
                      return (
                        <tr
                          key={t.id}
                          style={{
                            background: isSelected ? 'var(--color-brand-50)' : undefined,
                            cursor: isClosed || t.isMatched ? 'default' : 'pointer',
                          }}
                          onClick={() => {
                            if (!isClosed && !t.isMatched) {
                              setSelectedBookTxnId(isSelected ? null : t.id)
                            }
                          }}
                        >
                          <td>
                            {!t.isMatched && !isClosed && (
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => setSelectedBookTxnId(isSelected ? null : t.id)}
                              />
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{t.description}</div>
                            {t.reference && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isAr ? 'المرجع: ' : isTr ? 'Ref: ' : 'Ref: '}{t.reference}</span>}
                          </td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {isPositive ? '+' : '-'}{formatCurrency(t.amount, currency)}
                          </td>
                          <td>
                            {t.isMatched ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                {isAr ? 'مطابق' : isTr ? 'Eşleşti' : 'Matched'}
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                {isAr ? 'غير مطابق' : isTr ? 'Eşleşmedi' : 'Unmatched'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matched Pairs & Adjustments Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        
        {/* Matched Pairs Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAr ? `الحركات المتطابقة (${matches.length})` : isTr ? `Eşleşen İşlem Çiftleri (${matches.length})` : `Matched Transaction Pairs (${matches.length})`}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {matches.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد حركات متطابقة في هذه الجلسة بعد.' : isTr ? 'Bu oturumda henüz eşleşen işlem yok.' : 'No matched pairs in this reconciliation session yet.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'بند كشف الحساب' : isTr ? 'Ekstre Satırı' : 'Statement Line'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'حركة الدفاتر' : isTr ? 'Defter İşlemi' : 'Book Txn'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'قاعدة المطابقة' : isTr ? 'Eşleşme Kuralı' : 'Match Rule'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'إجراء' : isTr ? 'İşlem' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{m.statementLineDesc}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-brand-600)' }}>
                            {formatCurrency(m.statementLineAmount, currency)}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{m.bankTxnDesc}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-brand-600)' }}>
                            {formatCurrency(m.bankTxnAmount, currency)}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                            {m.matchType === 'auto' ? (isAr ? 'آلي' : isTr ? 'Otomatik' : 'Auto') : (isAr ? 'يدوي' : isTr ? 'Manuel' : 'Manual')}
                          </span>
                        </td>
                        <td>
                          {!isClosed && (
                            <button
                              onClick={() => handleUnmatch(m.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                              title={isAr ? 'إلغاء المطابقة' : isTr ? 'Eşleştirmeyi Kaldır' : 'Unmatch Pair'}
                            >
                              <Unlink size={13} />
                              {isAr ? 'إلغاء المطابقة' : isTr ? 'Kaldır' : 'Unmatch'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Reconciliation Adjustments Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAr ? `التسويات المحاسبية المعتمدة (${adjustments.length})` : isTr ? `Kontrollü Muhasebe Düzeltmeleri (${adjustments.length})` : `Controlled GL Adjustments (${adjustments.length})`}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {adjustments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد تسويات محاسبية مرحلة لهذه الجلسة.' : isTr ? 'Bu oturum için düzeltme kaydı yok.' : 'No adjustments posted for this session.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'السبب' : isTr ? 'Neden' : 'Reason'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'حساب الدليل' : isTr ? 'Muhasebe Hesabı' : 'GL Account'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date'}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                            {getReasonLabel(a.reason)}
                          </span>
                          {a.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.notes}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{a.glAccountCode}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.glAccountName}</div>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>{new Date(a.date).toLocaleDateString()}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(a.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1. New Session Modal */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title={isAr ? 'بدء جلسة تسوية بنكية جديدة' : isTr ? 'Yeni Banka Mutabakat Oturumu Başlat' : 'Start Bank Reconciliation Session'}
      >
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? 'تاريخ إقفال الكشف البنكي *' : isTr ? 'Ekstre Kapanış Tarihi *' : 'Statement Cutoff Date *'}
            </label>
            <input
              type="date"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? `الرصيد الختامي للكشف البنكي (${currency}) *` : isTr ? `Kapanış Ekstre Bakiyesi (${currency}) *` : `Ending Statement Balance (${currency}) *`}
            </label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              placeholder="0.00"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsSessionModalOpen(false)} disabled={loading}>
              {isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isAr ? 'جاري البدء...' : isTr ? 'Başlatılıyor...' : 'Starting...') : (isAr ? 'بدء الجلسة' : isTr ? 'Oturumu Başlat' : 'Start Session')}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Auto-Match Modal */}
      <Modal
        isOpen={isAutoMatchModalOpen}
        onClose={() => setIsAutoMatchModalOpen(false)}
        title={isAr ? 'إعدادات محرك المطابقة الآلية' : isTr ? 'Otomatik Eşleştirme Motorunu Yapılandır' : 'Configure Auto-Match Engine'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {isAr
              ? 'يقوم محرك المطابقة الآلية بفحص بنود كشف الحساب وقيود دفتر الأستاذ العام بناءً على تطابق المبالغ ونطاق التفاوت في التواريخ وتوافق المرجع.'
              : isTr
              ? 'Otomatik eşleştirme motoru, ekstre satırlarını ve büyük defter işlemlerini tutar eşleşmesi, tarih toleransı ve referans kurallarına göre değerlendirir.'
              : 'The auto-matching engine evaluates statement lines and general ledger transactions based on exact amount matching, date tolerance windows, and reference heuristics.'}
          </p>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? 'نطاق التفاوت الزمني المقبول (أيام)' : isTr ? 'Tarih Toleransı (Gün)' : 'Date Tolerance (Days)'}
            </label>
            <input
              type="number"
              min="0"
              max="30"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              value={dateToleranceDays}
              onChange={(e) => setDateToleranceDays(e.target.value)}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={matchReference}
              onChange={(e) => setMatchReference(e.target.checked)}
            />
            {isAr ? 'مطابقة أرقام المراجع والعمليات الخارجية' : isTr ? 'Referans ve harici işlem no eşleşmesini uygula' : 'Match reference & external transaction ID heuristics'}
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAutoMatchModalOpen(false)} disabled={loading}>
              {isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAutoMatch} disabled={loading}>
              {loading ? (isAr ? 'جاري التشغيل...' : isTr ? 'Çalıştırılıyor...' : 'Running...') : (isAr ? 'تشغيل المطابقة الآلية' : isTr ? 'Otomatik Eşleştirmeyi Başlat' : 'Run Auto-Match')}
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Controlled Adjustment Modal */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title={isAr ? 'تسجيل تسوية محاسبية بنكية معتمدة' : isTr ? 'Kontrollü Mutabakat Düzeltmesi Kaydet' : 'Post Controlled Reconciliation Adjustment'}
      >
        <form onSubmit={handlePostAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'سبب التسوية *' : isTr ? 'Düzeltme Nedeni *' : 'Adjustment Reason *'}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value as any)}
              >
                <option value="bank_fee">{isAr ? 'رسوم وعمولات بنكية' : isTr ? 'Banka Masrafı / Hizmet Ücreti' : 'Bank Fee / Service Charge'}</option>
                <option value="interest_income">{isAr ? 'فوائد / إيرادات بنكية' : isTr ? 'Faiz Geliri' : 'Interest Income'}</option>
                <option value="interest_expense">{isAr ? 'فوائد مدينة / مصروفات تمويل' : isTr ? 'Faiz Gideri' : 'Interest Expense'}</option>
                <option value="bank_charge">{isAr ? 'مصاريف مصرفية أخرى' : isTr ? 'Banka Gideri' : 'Bank Charge'}</option>
                <option value="timing_difference">{isAr ? 'فروق توقيت وتحصيل' : isTr ? 'Zamanlama Farkı' : 'Timing Difference'}</option>
                <option value="other">{isAr ? 'تسوية أخرى معتمدة' : isTr ? 'Diğer Onaylı Düzeltme' : 'Other Approved Adjustment'}</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? `المبلغ (${currency}) *` : isTr ? `Tutar (${currency}) *` : `Amount (${currency}) *`}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                placeholder="0.00"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'حساب التسوية في الدليل *' : isTr ? 'Karşı Muhasebe Hesabı (GL) *' : 'GL Counterpart Account *'}
              </label>
              <AccountSearchSelect
                accounts={glAccounts}
                value={adjGlAccountId}
                onChange={(val) => setAdjGlAccountId(val)}
                placeholder={isAr ? '-- ابحث برقم أو اسم الحساب --' : isTr ? '-- Hesap adı veya koduyla ara --' : '-- Search by account code or name --'}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'التاريخ *' : isTr ? 'Tarih *' : 'Date *'}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? 'المبرر / ملاحظات التدقيق' : isTr ? 'Gerekçe / Denetim Notları' : 'Justification / Audit Notes'}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              placeholder={isAr ? 'مثال: عمولة تحويل بنكي غير مقيدة بالدفاتر تم اكتشافها أثناء التسوية' : isTr ? 'Örn: Mutabakat sırasında fark edilen kaydedilmemiş havale masrafı' : 'e.g. Unrecorded wire transfer fee noted during reconciliation'}
              value={adjNotes}
              onChange={(e) => setAdjNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustmentModalOpen(false)} disabled={loading}>
              {isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isAr ? 'جاري الترحيل...' : isTr ? 'İşleniyor...' : 'Posting...') : (isAr ? 'ترحيل قيد التسوية' : isTr ? 'Düzeltme Kaydını İşle' : 'Post GL Adjustment')}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Audited Reopen Modal */}
      <Modal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        title={isAr ? 'إعادة فتح فترة التسوية البنكية المقفلة' : isTr ? 'Kilitli Mutabakat Dönemini Yeniden Aç' : 'Reopen Closed Reconciliation Period'}
      >
        <form onSubmit={handleReopenPeriod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: '#92400e' }}>
            <AlertTriangle size={16} style={{ display: 'inline', [isAr ? 'marginLeft' : 'marginRight']: '0.25rem' }} />
            {isAr
              ? 'إعادة فتح فترة التسوية يلغي قفل البنود المتطابقة ويتم توثيقه وتتبعه بدقة في سجل التدقيق الرقابي.'
              : isTr
              ? 'Kilitli bir mutabakatı yeniden açmak eşleşen ekstre kalemlerinin kilidini açar ve denetim günlüğüne kaydedilir.'
              : 'Reopening a closed reconciliation unlocks matched statement items and is strictly recorded in the executive audit log.'}
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? 'سبب ومبرر إعادة الفتح الإلزامي *' : isTr ? 'Zorunlu Yeniden Açma Gerekçesi *' : 'Mandatory Reopening Justification *'}
            </label>
            <textarea
              className="form-input"
              rows={3}
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              placeholder={isAr ? 'مثال: اكتشاف تكرار صرف شيك مورد يتطلب إعادة المطابقة اليدوية' : isTr ? 'Örn: Yeniden eşleştirme gerektiren mükerrer çek kaydı tespiti' : 'e.g. Discovered duplicate vendor check posting requiring manual rematching'}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsReopenModalOpen(false)} disabled={loading}>
              {isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? (isAr ? 'جاري إعادة الفتح...' : isTr ? 'Yeniden Açılıyor...' : 'Reopening...') : (isAr ? 'تأكيد إعادة فتح الفترة' : isTr ? 'Dönemi Açmayı Onayla' : 'Confirm Reopen Period')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
