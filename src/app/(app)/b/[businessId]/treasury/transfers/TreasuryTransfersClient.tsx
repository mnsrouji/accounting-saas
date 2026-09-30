'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Landmark,
  Coins,
  Send,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import {
  createTransferAction,
  approveTransferAction,
  postTransferAction,
} from '@/actions/treasury/treasury-actions'

interface TransferRow {
  id: string
  transferNumber: string
  sourceAccountType: string
  sourceAccountId: string
  sourceAccountName: string
  destinationAccountType: string
  destinationAccountId: string
  destinationAccountName: string
  amount: number
  currency: string
  destinationAmount: number | null
  destinationCurrency: string | null
  exchangeRate: number | null
  status: string
  transferDate: string
  reference: string | null
  notes: string | null
  postedAt: string | null
}

interface TreasuryTransfersClientProps {
  businessId: string
  defaultCurrency: string
  transfers: TransferRow[]
  cashAccounts: Array<{ id: string; name: string; currency: string; balance: number }>
  bankAccounts: Array<{ id: string; name: string; bankName: string; currency: string; balance: number }>
}

export function TreasuryTransfersClient({
  businessId,
  defaultCurrency,
  transfers,
  cashAccounts,
  bankAccounts,
}: TreasuryTransfersClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Form State
  const [sourceType, setSourceType] = useState<'cash' | 'bank'>('bank')
  const [sourceId, setSourceId] = useState(bankAccounts[0]?.id || '')
  const [destType, setDestType] = useState<'cash' | 'bank'>('cash')
  const [destId, setDestId] = useState(cashAccounts[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [exchangeRate, setExchangeRate] = useState('1.0')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    transfersBreadcrumb: isAr ? 'التحويلات المالية الداخلية' : isTr ? 'İç Transferler' : 'Internal Transfers',
    title: isAr ? 'التحويلات المالية الداخلية (بنوك / خزينة)' : isTr ? 'Hazine İçi Para Transferleri' : 'Treasury Internal Transfers',
    subtitle: isAr
      ? 'نقل الأموال بين الحسابات البنكية والخزائن مع دورة اعتماد محكمة: مسودة ← معتمد ← مرحل محاسبياً'
      : isTr
      ? 'Banka ve kasa hesapları arasında çoklu para birimli fon transferleri ve onay mekanizması'
      : 'Controlled multi-currency fund movements with Draft → Approved → Posted governance',
    newTransferBtn: isAr ? 'تحويل مالي جديد' : isTr ? 'Yeni Para Transferi' : 'New Internal Transfer',
    colNumber: isAr ? 'رقم التحويل' : isTr ? 'Transfer No' : 'Transfer #',
    colDate: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    colRoute: isAr ? 'مسار التحويل (من ← إلى)' : isTr ? 'Transfer Rotası (Kaynak → Hedef)' : 'Transfer Route (From → To)',
    colAmount: isAr ? 'المبلغ المحول' : isTr ? 'Tutar' : 'Amount',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    colActions: isAr ? 'إجراءات الاعتماد' : isTr ? 'Onay İşlemleri' : 'Workflow Actions',
    postedBadge: isAr ? 'مرحل للأستاذ' : isTr ? 'Muhasebeye İşlendi' : 'Posted',
    approvedBadge: isAr ? 'معتمد' : isTr ? 'Onaylandı' : 'Approved',
    draftBadge: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
    approveBtn: isAr ? 'اعتماد التحويل' : isTr ? 'Onayla' : 'Approve',
    postGlBtn: isAr ? 'ترحيل للأستاذ العام' : isTr ? 'Yevmiyeye İşle' : 'Post to GL',
    finalizedLabel: isAr ? 'مكتمل ومرحل' : isTr ? 'Tamamlandı' : 'Finalized',
    searchPlaceholder: isAr ? 'بحث برقم التحويل، الحساب المصدر، المستلم، أو المرجع...' : isTr ? 'Transfer no, kaynak, hedef veya referansa göre ara...' : 'Search transfers by number, route, reference, or notes...',
    emptyTitle: isAr ? 'لا توجد تحويلات مالية مسجلة' : isTr ? 'Kayıtlı İç Transfer Yok' : 'No internal transfers recorded',
    emptySubtext: isAr
      ? 'اضغط على "تحويل مالي جديد" لبدء نقل الأموال بين البنوك والخزائن.'
      : isTr
      ? 'Hesaplar arası para transferi başlatmak için "Yeni Para Transferi" butonuna tıklayın.'
      : "Click 'New Internal Transfer' to initiate a fund movement.",
    modalTitle: isAr ? 'إنشاء تحويل مالي داخلي' : isTr ? 'İç Transfer Oluştur' : 'Create Internal Transfer',
    sourceCard: isAr ? 'الحساب المصدر (من)' : isTr ? 'Kaynak Hesap (Çıkış)' : 'Source Account (From)',
    destCard: isAr ? 'الحساب المستلم (إلى)' : isTr ? 'Hedef Hesap (Giriş)' : 'Destination Account (To)',
    bankOpt: isAr ? 'بنك' : isTr ? 'Banka' : 'Bank',
    cashOpt: isAr ? 'خزينة / صندوق' : isTr ? 'Kasa' : 'Cash',
    amountLabel: isAr ? 'مبلغ التحويل *' : isTr ? 'Transfer Tutarı *' : 'Transfer Amount *',
    currencyLabel: isAr ? 'العملة *' : isTr ? 'Para Birimi *' : 'Currency *',
    fxRateLabel: isAr ? 'سعر الصرف (FX)' : isTr ? 'Döviz Kuru' : 'FX Rate',
    transferDateLabel: isAr ? 'تاريخ التحويل *' : isTr ? 'Transfer Tarihi *' : 'Transfer Date *',
    refLabel: isAr ? 'رقم المرجع / الشيك (اختياري)' : isTr ? 'Referans / Çek No (İsteğe bağlı)' : 'Reference # (Optional)',
    refPlaceholder: isAr ? 'رقم الشيك أو الحوالة...' : isTr ? 'Çek no / Dekont no...' : 'Check # / Authorization #',
    notesLabel: isAr ? 'الغرض والملاحظات' : isTr ? 'Açıklama / Transfer Amacı' : 'Notes / Purpose',
    notesPlaceholder: isAr ? 'مثال: تغذية صندوق الفرع، إعادة توازن السيولة...' : isTr ? 'Örn: Şube kasasına avans takviyesi, banka likidite dengelemesi...' : 'e.g. Replenishing branch cash till, inter-bank liquidity rebalancing',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    createDraftBtn: isAr ? 'حفظ التحويل (مسودة)' : isTr ? 'Transferi Oluştur (Taslak)' : 'Create Transfer (Draft)',
    creatingBtn: isAr ? 'جاري الحفظ...' : isTr ? 'Kaydediliyor...' : 'Creating...',
    errReq: isAr ? 'الحساب المصدر والمستلم حقول إلزامية' : isTr ? 'Kaynak ve hedef hesap zorunludur' : 'Source and Destination accounts are required',
    errSame: isAr ? 'لا يمكن أن يكون الحساب المصدر والمستلم نفس الحساب' : isTr ? 'Kaynak ve hedef hesap aynı olamaz' : 'Source and Destination accounts cannot be the same',
    errPositiveAmount: isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : isTr ? 'Geçerli ve pozitif bir tutar giriniz' : 'Valid positive amount is required',
    successCreated: (num: string) =>
      isAr ? `تم إنشاء التحويل الداخلي ${num} كمسودة بنجاح!` : isTr ? `${num} nolu iç transfer taslak olarak oluşturuldu!` : `Internal Transfer ${num} created in Draft status!`,
    successApproved: isAr ? 'تم اعتماد التحويل بنجاح!' : isTr ? 'Transfer başarıyla onaylandı!' : 'Transfer approved successfully!',
    successPosted: isAr ? 'تم ترحيل التحويل وإنشاء قيد اليومية المزدوج في الأستاذ العام!' : isTr ? 'Transfer muhasebeye işlendi ve yevmiye maddesi oluşturuldu!' : 'Transfer posted and double-entry journal created in General Ledger!',
  }

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceId || !destId) {
      toast.error(t.errReq)
      return
    }
    if (sourceType === destType && sourceId === destId) {
      toast.error(t.errSame)
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t.errPositiveAmount)
      return
    }

    setLoading(true)
    try {
      const res = await createTransferAction(businessId, {
        sourceAccountType: sourceType,
        sourceAccountId: sourceId,
        destinationAccountType: destType,
        destinationAccountId: destId,
        amount: parseFloat(amount),
        currency,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        transferDate: new Date(transferDate),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if (res.success) {
        toast.success(t.successCreated((res.transfer as any)?.transferNumber || ''))
        setIsModalOpen(false)
        setAmount('')
        setReference('')
        setNotes('')
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to create transfer')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (transferId: string) => {
    setActionLoadingId(transferId)
    try {
      const res = await approveTransferAction(businessId, transferId)
      if (res.success) {
        toast.success(t.successApproved)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to approve transfer')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handlePost = async (transferId: string) => {
    setActionLoadingId(transferId)
    try {
      const res = await postTransferAction(businessId, transferId)
      if (res.success) {
        toast.success(t.successPosted)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to post transfer')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const columns: Column<TransferRow>[] = [
    {
      key: 'transferNumber',
      header: t.colNumber,
      sortable: true,
      sortValue: (r) => r.transferNumber,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>
          {r.transferNumber}
        </span>
      ),
    },
    {
      key: 'date',
      header: t.colDate,
      sortable: true,
      sortValue: (r) => r.transferDate,
      accessor: (r) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(r.transferDate)}</span>,
    },
    {
      key: 'route',
      header: t.colRoute,
      accessor: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {r.sourceAccountType === 'cash' ? <Coins size={14} className="text-warning" /> : <Landmark size={14} className="text-info" />}
            <span style={{ fontWeight: 500 }}>{r.sourceAccountName}</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {r.destinationAccountType === 'cash' ? <Coins size={14} className="text-warning" /> : <Landmark size={14} className="text-info" />}
            <span style={{ fontWeight: 500 }}>{r.destinationAccountName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t.colAmount,
      sortable: true,
      sortValue: (r) => r.amount,
      accessor: (r) => (
        <div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(r.amount, r.currency)}</div>
          {r.destinationCurrency && r.destinationCurrency !== r.currency && r.destinationAmount && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              → {formatCurrency(r.destinationAmount, r.destinationCurrency)} (Rate: {r.exchangeRate})
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t.colStatus,
      sortable: true,
      sortValue: (r) => r.status,
      accessor: (r) => {
        if (r.status === 'posted') {
          return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={12} /> {t.postedBadge}</span>
        }
        if (r.status === 'approved') {
          return <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} /> {t.approvedBadge}</span>
        }
        return <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {t.draftBadge}</span>
      },
    },
    {
      key: 'actions',
      header: t.colActions,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {r.status === 'draft' && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => handleApprove(r.id)}
              disabled={actionLoadingId === r.id}
            >
              <Check size={12} /> {t.approveBtn}
            </button>
          )}
          {r.status === 'approved' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handlePost(r.id)}
              disabled={actionLoadingId === r.id}
            >
              <Send size={12} /> {t.postGlBtn}
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
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.transfersBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> {t.newTransferBtn}
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-body">
          <DataTable
            data={transfers}
            columns={columns}
            searchKey={(r) => `${r.transferNumber} ${r.sourceAccountName} ${r.destinationAccountName} ${r.reference || ''}`}
            searchPlaceholder={t.searchPlaceholder}
            emptyTitle={t.emptyTitle}
            emptySubtext={t.emptySubtext}
          />
        </div>
      </div>

      {/* New Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t.modalTitle}
      >
        <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Source Account */}
          <div style={{ background: 'var(--bg-page)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
              {t.sourceCard}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
              <select
                className="form-input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
                value={sourceType}
                onChange={(e) => {
                  const type = e.target.value as 'cash' | 'bank'
                  setSourceType(type)
                  setSourceId(type === 'bank' ? bankAccounts[0]?.id || '' : cashAccounts[0]?.id || '')
                }}
              >
                <option value="bank">{t.bankOpt}</option>
                <option value="cash">{t.cashOpt}</option>
              </select>

              <select
                className="form-input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                required
              >
                {sourceType === 'bank'
                  ? bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.bankName} - {formatCurrency(b.balance, b.currency)})
                      </option>
                    ))
                  : cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.balance, c.currency)})
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Destination Account */}
          <div style={{ background: 'var(--bg-page)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
              {t.destCard}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
              <select
                className="form-input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
                value={destType}
                onChange={(e) => {
                  const type = e.target.value as 'cash' | 'bank'
                  setDestType(type)
                  setDestId(type === 'cash' ? cashAccounts[0]?.id || '' : bankAccounts[0]?.id || '')
                }}
              >
                <option value="cash">{t.cashOpt}</option>
                <option value="bank">{t.bankOpt}</option>
              </select>

              <select
                className="form-input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                required
              >
                {destType === 'cash'
                  ? cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.balance, c.currency)})
                      </option>
                    ))
                  : bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.bankName} - {formatCurrency(b.balance, b.currency)})
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Amount & Currency */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.amountLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.currencyLabel}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="SAR">SAR</option>
                <option value="AED">AED</option>
                <option value="TRY">TRY</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.fxRateLabel}
              </label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.transferDateLabel}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.refLabel}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder={t.refPlaceholder}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.notesLabel}
            </label>
            <textarea
              className="form-input"
              rows={2}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.creatingBtn : t.createDraftBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

