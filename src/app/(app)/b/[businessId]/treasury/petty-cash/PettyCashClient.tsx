'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  WalletCards,
  Plus,
  Coins,
  CheckCircle2,
  Clock,
  Check,
  Send,
  AlertTriangle,
  FileCheck,
  Calculator,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import {
  createPettyCashCountAction,
  reviewPettyCashCountAction,
  postPettyCashCountAction,
} from '@/actions/treasury/treasury-actions'

interface PettyCashAccount {
  id: string
  name: string
  currency: string
  balance: number
  custodianName: string | null
  targetFloat: number | null
  glAccountCode: string
  glAccountName: string
}

interface CashCountRow {
  id: string
  countNumber: string
  cashAccountId: string
  cashAccountName: string
  currency: string
  countDate: string
  systemBalance: number
  countedBalance: number
  varianceAmount: number
  status: string
  notes: string | null
  reviewedAt: string | null
  postedAt: string | null
  denominations: Array<{ denomination: number; count: number; amount: number }>
}

interface PettyCashClientProps {
  businessId: string
  defaultCurrency: string
  pettyCashAccounts: PettyCashAccount[]
  cashCounts: CashCountRow[]
  glAccounts: Array<{ id: string; code: string; name: string; type: string }>
}

const DEFAULT_DENOMINATIONS = [100, 50, 20, 10, 5, 1, 0.25, 0.10, 0.05, 0.01]

export function PettyCashClient({
  businessId,
  defaultCurrency,
  pettyCashAccounts,
  cashCounts,
  glAccounts,
}: PettyCashClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isCountModalOpen, setIsCountModalOpen] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Count Form State
  const [selectedAccountId, setSelectedAccountId] = useState(pettyCashAccounts[0]?.id || '')
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [denomCounts, setDenomCounts] = useState<{ [denom: number]: number }>(() => {
    const init: { [denom: number]: number } = {}
    DEFAULT_DENOMINATIONS.forEach((d) => (init[d] = 0))
    return init
  })

  // Post modal state
  const [targetCountToPost, setTargetCountToPost] = useState<CashCountRow | null>(null)
  const [varianceGlAccountId, setVarianceGlAccountId] = useState(
    glAccounts.find((g) => g.type === 'expense')?.id || glAccounts[0]?.id || ''
  )

  const activeAccount = pettyCashAccounts.find((a) => a.id === selectedAccountId)
  const currency = activeAccount?.currency || defaultCurrency

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    pettyCashBreadcrumb: isAr ? 'العهد النقدية والجرد' : isTr ? 'Küçük Kasa ve Sayım' : 'Petty Cash',
    title: isAr ? 'العهد النقدية والجرد الفعلي للصناديق' : isTr ? 'Küçük Kasa Avansları ve Fiili Sayımlar' : 'Petty Cash Floats & Physical Counts',
    subtitle: isAr
      ? 'متابعة عهد المشرفين، الجرد الفعلي لفئات النقد والعملات المعدنية، والمعالجة الآلية لفروقات الجرد'
      : isTr
      ? 'Kasa sorumlusu avansları, banknot ve madeni para küpür sayımı ve otomatik sayım farkı muhasebesi'
      : 'Custodian float tracking, banknote denomination counts, and automatic variance accounting',
    newCountBtn: isAr ? 'جرد فعلي جديد للنقد' : isTr ? 'Yeni Fiili Kasa Sayımı' : 'New Physical Cash Count',
    noAccountsConfigured: isAr
      ? 'لا توجد حسابات عهد نقدية معرفة. يرجى تفعيل خيار "عهدة نقدية" عند إنشاء حساب خزينة جديد.'
      : isTr
      ? 'Tanımlı küçük kasa hesabı yok. Yeni kasa oluştururken "Küçük Kasa / Avans" seçeneğini işaretleyin.'
      : 'No petty cash accounts configured. Enable "Petty Cash" checkbox when creating a cash account.',
    custodianLabel: isAr ? 'أمين العهدة:' : isTr ? 'Sorumlu:' : 'Custodian:',
    unassigned: isAr ? 'غير محدد' : isTr ? 'Atanmamış' : 'Unassigned',
    pettyBadge: isAr ? 'عهدة نقدية' : isTr ? 'Küçük Kasa' : 'Petty Cash',
    targetFloatLabel: isAr ? 'السقف المالي للعهدة:' : isTr ? 'Hedef Avans Limiti:' : 'Target Float:',
    unrestricted: isAr ? 'غير مقيد' : isTr ? 'Sınırsız' : 'Unrestricted',
    historyTableTitle: isAr ? 'سجل عمليات الجرد الفعلي للنقد' : isTr ? 'Fiili Kasa Sayımları Geçmişi' : 'Physical Cash Counts History',
    colNumber: isAr ? 'رقم الجرد' : isTr ? 'Sayım No' : 'Count #',
    colDate: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    colAccount: isAr ? 'حساب العهدة' : isTr ? 'Kasa Hesabı' : 'Petty Cash Account',
    colSystemBook: isAr ? 'الرصيد الدفتري' : isTr ? 'Kayıtlı Bakiye' : 'System Book',
    colCountedCash: isAr ? 'النقد الفعلي المعدود' : isTr ? 'Sayılan Nakit' : 'Counted Cash',
    colVariance: isAr ? 'فروقات الجرد' : isTr ? 'Sayım Farkı' : 'Variance',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    colActions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Workflow Actions',
    balancedBadge: isAr ? '✓ مطابق تماماً' : isTr ? '✓ Denk' : '✓ Balanced',
    statusPosted: isAr ? 'مرحل للأستاذ' : isTr ? 'Muhasebeye İşlendi' : 'Posted',
    statusReviewed: isAr ? 'تم التدقيق' : isTr ? 'Denetlendi' : 'Reviewed',
    statusCounted: isAr ? 'تم الجرد' : isTr ? 'Sayıldı' : 'Counted',
    reviewBtn: isAr ? 'تدقيق واعتماد' : isTr ? 'Denetle ve Onayla' : 'Review',
    postBtn: isAr ? 'ترحيل للأستاذ' : isTr ? 'Yevmiyeye İşle' : 'Post to GL',
    finalizedLabel: isAr ? 'مكتمل ومرحل' : isTr ? 'Kesinleşti' : 'Finalized',
    searchPlaceholder: isAr ? 'بحث برقم الجرد، اسم الحساب، أو الحالة...' : isTr ? 'Sayım no, hesap veya duruma göre ara...' : 'Search counts by number, account, or status...',
    emptyTitle: isAr ? 'لا توجد عمليات جرد مسجلة حتى الآن' : isTr ? 'Kayıtlı Fiili Sayım Yok' : 'No physical cash counts recorded yet',
    emptySubtext: isAr ? 'اضغط على زر "جرد فعلي جديد للنقد" لبدء تسجيل الفئات النقدية.' : isTr ? 'Küpür sayımı kaydetmek için "Yeni Fiili Kasa Sayımı" butonuna tıklayın.' : "Click 'New Physical Cash Count' to perform a denomination count.",
    modalTitle: isAr ? 'إجراء جرد فعلي للنقد والعهد' : isTr ? 'Fiili Kasa Sayımı Yap' : 'Perform Physical Cash Count',
    accField: isAr ? 'حساب العهدة النقدية *' : isTr ? 'Küçük Kasa Hesabı *' : 'Petty Cash Account *',
    dateField: isAr ? 'تاريخ الجرد *' : isTr ? 'Sayım Tarihi *' : 'Count Date *',
    gridTitle: isAr ? 'جدول حصر فئات العملات الورقية والمعدنية' : isTr ? 'Banknot ve Madeni Para Küpür Tablosu' : 'Banknote & Coin Denomination Grid',
    qtyPlaceholder: isAr ? 'العدد' : isTr ? 'Adet' : 'Qty',
    countedTotalLabel: isAr ? 'إجمالي النقد الفعلي' : isTr ? 'Toplam Sayılan Nakit' : 'Counted Cash Total',
    systemBalLabel: isAr ? 'الرصيد الدفتري بالنظام' : isTr ? 'Sistem Kayıtlı Bakiye' : 'System Book Balance',
    varianceLabel: isAr ? 'الفارق الفعلي (عجز / زيادة)' : isTr ? 'Canlı Fark (Fazla / Eksik)' : 'Live Variance',
    notesLabel: isAr ? 'ملاحظات وتفاصيل الجرد' : isTr ? 'Sayım Açıklaması / Notlar' : 'Count Notes / Observations',
    notesPlaceholder: isAr ? 'مثال: جرد مفاجئ في نهاية الأسبوع بمعرفة المراجع الداخلي' : isTr ? 'Örn: Dönem sonu iç denetim kasa sayımı' : 'e.g. End of week physical verification by auditor',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    submitCount: isAr ? 'حفظ الجرد الفعلي' : isTr ? 'Sayımı Kaydet' : 'Submit Cash Count',
    submitting: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Submitting...',
    postModalTitle: isAr ? 'ترحيل الجرد وإنشاء قيود الفروقات' : isTr ? 'Sayımı Onayla ve Yevmiyeye Aktar' : 'Post Cash Count & Adjust GL',
    postModalPrompt: (num: string, acc: string) => isAr ? `أنت على وشك ترحيل الجرد رقم ${num} للحساب ${acc}.` : isTr ? `${acc} hesabı için ${num} numaralı sayımı onaylamak üzeresiniz.` : `You are posting Cash Count ${num} for account ${acc}.`,
    countedBalanceLabel: isAr ? 'الرصيد الفعلي المعدود:' : isTr ? 'Sayılan Bakiye:' : 'Counted Balance:',
    varianceAmountLabel: isAr ? 'الفارق:' : isTr ? 'Fark:' : 'Variance:',
    glCounterpartLabel: isAr ? 'حساب فروقات الجرد في شجرة الحسابات (الأرباح والخسائر) *' : isTr ? 'Sayım Farkı Muhasebe Hesabı (Gelir/Gider Hesabı) *' : 'Variance GL Counterpart Account *',
    glCounterpartHint: isAr ? 'في حال وجود فارق، سيتم إنشاء قيد يومية تلقائي لتحميل الفارق على هذا الحساب.' : isTr ? 'Sıfırdan farklı sayım farkı bu hesaba otomatik yevmiye maddesi oluşturur.' : 'Non-zero variance creates an automated journal entry booking the difference to this GL account.',
    confirmPostBtn: isAr ? 'تأكيد الترحيل للأستاذ العام' : isTr ? 'Yevmiyeye İşlemeyi Onayla' : 'Confirm Post to GL',
    posting: isAr ? 'جارٍ الترحيل...' : isTr ? 'İşleniyor...' : 'Posting...',
    selectAccountErr: isAr ? 'يرجى اختيار حساب العهدة النقدية' : isTr ? 'Lütfen bir kasa hesabı seçin' : 'Please select a petty cash account',
  }

  // Calculate live counted total
  const countedTotal = Object.entries(denomCounts).reduce(
    (sum, [denom, count]) => sum + parseFloat(denom) * (count || 0),
    0
  )
  const systemBalance = activeAccount?.balance || 0
  const liveVariance = countedTotal - systemBalance

  const handleDenomChange = (denom: number, val: string) => {
    const count = parseInt(val) || 0
    setDenomCounts((prev) => ({ ...prev, [denom]: Math.max(0, count) }))
  }

  const handleCreateCount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccountId) {
      toast.error(t.selectAccountErr)
      return
    }

    const denomsArray = Object.entries(denomCounts)
      .filter(([_, count]) => count > 0)
      .map(([denom, count]) => ({
        denomination: parseFloat(denom),
        count,
      }))

    if (denomsArray.length === 0 && countedTotal === 0) {
      if (!confirm(isAr ? 'أنت تقدم جرد نقدي بقيمة صفر. هل ترغب بالمتابعة؟' : 'You are submitting a cash count of zero. Proceed?')) return
    }

    setLoading(true)
    try {
      const res = await createPettyCashCountAction(businessId, {
        cashAccountId: selectedAccountId,
        countDate: new Date(countDate),
        denominations: denomsArray.length > 0 ? denomsArray : [{ denomination: 1, count: 0 }],
        notes: notes.trim() || undefined,
      })

      if (res.success) {
        toast.success(isAr ? `تم إنشاء الجرد ${(res.count as any)?.countNumber || ''} بنجاح!` : `Cash count ${(res.count as any)?.countNumber || ''} created!`)
        setIsCountModalOpen(false)
        setNotes('')
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to create cash count')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (countId: string) => {
    setActionLoadingId(countId)
    try {
      const res = await reviewPettyCashCountAction(businessId, countId)
      if (res.success) {
        toast.success(isAr ? 'تم تدقيق واعتماد الجرد بنجاح!' : 'Cash count reviewed and verified!')
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to review count')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleOpenPostModal = (count: CashCountRow) => {
    setTargetCountToPost(count)
    setIsPostModalOpen(true)
  }

  const handleConfirmPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCountToPost) return

    setLoading(true)
    try {
      const res = await postPettyCashCountAction(businessId, {
        countId: targetCountToPost.id,
        varianceGlAccountId: targetCountToPost.varianceAmount !== 0 ? varianceGlAccountId : undefined,
      })

      if (res.success) {
        toast.success(isAr ? 'تم ترحيل الجرد وإنشاء قيد الفروقات المحاسبي بنجاح!' : 'Cash count posted and GL variance entry synchronized!')
        setIsPostModalOpen(false)
        setTargetCountToPost(null)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to post cash count')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<CashCountRow>[] = [
    {
      key: 'countNumber',
      header: t.colNumber,
      sortable: true,
      sortValue: (r) => r.countNumber,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>
          {r.countNumber}
        </span>
      ),
    },
    {
      key: 'date',
      header: t.colDate,
      sortable: true,
      sortValue: (r) => r.countDate,
      accessor: (r) => <span style={{ whiteSpace: 'nowrap' }}>{new Date(r.countDate).toLocaleDateString()}</span>,
    },
    {
      key: 'account',
      header: t.colAccount,
      sortable: true,
      sortValue: (r) => r.cashAccountName,
      accessor: (r) => <span style={{ fontWeight: 500 }}>{r.cashAccountName}</span>,
    },
    {
      key: 'systemBalance',
      header: t.colSystemBook,
      accessor: (r) => (
        <span style={{ direction: 'ltr', display: 'inline-block' }}>
          {formatCurrency(r.systemBalance, r.currency)}
        </span>
      ),
    },
    {
      key: 'countedBalance',
      header: t.colCountedCash,
      sortable: true,
      sortValue: (r) => r.countedBalance,
      accessor: (r) => (
        <span style={{ fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>
          {formatCurrency(r.countedBalance, r.currency)}
        </span>
      ),
    },
    {
      key: 'variance',
      header: t.colVariance,
      sortable: true,
      sortValue: (r) => r.varianceAmount,
      accessor: (r) => (
        <span
          style={{
            fontWeight: 700,
            direction: 'ltr',
            display: 'inline-block',
            color: r.varianceAmount === 0 ? 'var(--color-success)' : r.varianceAmount > 0 ? 'var(--color-brand-600)' : 'var(--color-danger)',
          }}
        >
          {r.varianceAmount === 0 ? t.balancedBadge : formatCurrency(r.varianceAmount, r.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.colStatus,
      sortable: true,
      sortValue: (r) => r.status,
      accessor: (r) => {
        if (r.status === 'posted') return <span className="badge badge-success">{t.statusPosted}</span>
        if (r.status === 'reviewed') return <span className="badge badge-info">{t.statusReviewed}</span>
        return <span className="badge badge-warning">{t.statusCounted}</span>
      },
    },
    {
      key: 'actions',
      header: t.colActions,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {r.status === 'counted' && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => handleReview(r.id)}
              disabled={actionLoadingId === r.id}
            >
              <Check size={12} /> {t.reviewBtn}
            </button>
          )}
          {r.status === 'reviewed' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleOpenPostModal(r)}
              disabled={actionLoadingId === r.id}
            >
              <Send size={12} /> {t.postBtn}
            </button>
          )}
          {r.status === 'posted' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t.finalizedLabel}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.pettyCashBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <WalletCards size={26} className="text-warning" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsCountModalOpen(true)}>
          <Calculator size={16} /> {t.newCountBtn}
        </button>
      </div>

      {/* Petty Cash Floats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {pettyCashAccounts.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              {t.noAccountsConfigured}
            </p>
          </div>
        ) : (
          pettyCashAccounts.map((a) => (
            <div key={a.id} className="stat-card" style={{ borderInlineStart: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{a.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.custodianLabel} {a.custodianName || t.unassigned}</div>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{t.pettyBadge}</span>
              </div>
              <div className="stat-card-value" style={{ marginTop: '0.75rem', color: '#b45309', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                {formatCurrency(a.balance, a.currency)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {t.targetFloatLabel} <span style={{ direction: 'ltr', display: 'inline-block' }}>{a.targetFloat ? formatCurrency(a.targetFloat, a.currency) : t.unrestricted}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Cash Counts History Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t.historyTableTitle}</span>
        </div>
        <div className="card-body">
          <DataTable
            data={cashCounts}
            columns={columns}
            searchKey={(r) => `${r.countNumber} ${r.cashAccountName} ${r.status}`}
            searchPlaceholder={t.searchPlaceholder}
            emptyTitle={t.emptyTitle}
            emptySubtext={t.emptySubtext}
          />
        </div>
      </div>

      {/* 1. New Physical Cash Count Modal */}
      <Modal
        isOpen={isCountModalOpen}
        onClose={() => setIsCountModalOpen(false)}
        title={t.modalTitle}
      >
        <form onSubmit={handleCreateCount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.accField}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                required
              >
                {pettyCashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency} - {formatCurrency(a.balance, a.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.dateField}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Denomination Counter Grid */}
          <div style={{ background: 'var(--bg-page)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {t.gridTitle}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {DEFAULT_DENOMINATIONS.map((d) => (
                <div key={d} style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                    {formatCurrency(d, currency)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.8125rem' }}
                    placeholder={t.qtyPlaceholder}
                    value={denomCounts[d] || ''}
                    onChange={(e) => handleDenomChange(d, e.target.value)}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: isAr ? 'left' : 'right', direction: 'ltr' }}>
                    = {formatCurrency(d * (denomCounts[d] || 0), currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Totals & Variance Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', background: 'var(--color-brand-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.countedTotalLabel}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-600)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                {formatCurrency(countedTotal, currency)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.systemBalLabel}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                {formatCurrency(systemBalance, currency)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.varianceLabel}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, direction: 'ltr', textAlign: isAr ? 'right' : 'left', color: liveVariance === 0 ? 'var(--color-success)' : liveVariance > 0 ? 'var(--color-brand-600)' : 'var(--color-danger)' }}>
                {liveVariance === 0 ? t.balancedBadge : formatCurrency(liveVariance, currency)}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.notesLabel}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCountModalOpen(false)} disabled={loading}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.submitting : t.submitCount}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Post Cash Count Modal */}
      <Modal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        title={t.postModalTitle}
      >
        <form onSubmit={handleConfirmPost} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {targetCountToPost && (
            <>
              <div style={{ fontSize: '0.875rem' }}>
                {t.postModalPrompt(targetCountToPost.countNumber, targetCountToPost.cashAccountName)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-page)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.countedBalanceLabel}</span>
                  <div style={{ fontWeight: 700, direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>{formatCurrency(targetCountToPost.countedBalance, targetCountToPost.currency)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.varianceAmountLabel}</span>
                  <div style={{ fontWeight: 700, direction: 'ltr', textAlign: isAr ? 'right' : 'left', color: targetCountToPost.varianceAmount === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(targetCountToPost.varianceAmount, targetCountToPost.currency)}
                  </div>
                </div>
              </div>

              {targetCountToPost.varianceAmount !== 0 && (
                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    {t.glCounterpartLabel}
                  </label>
                  <AccountSearchSelect
                    accounts={glAccounts}
                    value={varianceGlAccountId}
                    onChange={(val) => setVarianceGlAccountId(val)}
                    placeholder={isAr ? '-- ابحث برقم أو اسم الحساب --' : isTr ? '-- Hesap Ara --' : '-- Search by account code or name --'}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    {t.glCounterpartHint}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPostModalOpen(false)} disabled={loading}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? t.posting : t.confirmPostBtn}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  )
}
