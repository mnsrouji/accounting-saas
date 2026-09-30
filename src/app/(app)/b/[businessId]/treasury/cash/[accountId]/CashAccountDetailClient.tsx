'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Coins,
  WalletCards,
  ArrowLeftRight,
  Receipt,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Calendar,
  Layers,
  FileCheck,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import { postTreasuryTransactionAction } from '@/actions/treasury/treasury-actions'

interface CashAccountDetailClientProps {
  businessId: string
  defaultCurrency: string
  account: {
    id: string
    name: string
    currency: string
    balance: number
    isPettyCash: boolean
    custodianName: string | null
    targetFloat: number | null
    description: string | null
    isActive: boolean
    glAccount: {
      id: string
      code: string
      name: string
    }
    createdAt: string
  }
  transactions: Array<{
    id: string
    type: string
    amount: number
    date: string
    description: string
    reference: string | null
    isPosted: boolean
    journalEntryId: string | null
  }>
  transfers: Array<{
    id: string
    transferNumber: string
    sourceAccountType: string
    sourceAccountId: string
    destinationAccountType: string
    destinationAccountId: string
    amount: number
    currency: string
    status: string
    transferDate: string
    reference: string | null
  }>
  cashCounts: Array<{
    id: string
    countNumber: string
    countDate: string
    systemBalance: number
    countedBalance: number
    varianceAmount: number
    status: string
    notes: string | null
  }>
  glAccounts: Array<{
    id: string
    code: string
    name: string
    type: string
  }>
}

export function CashAccountDetailClient({
  businessId,
  defaultCurrency,
  account,
  transactions,
  transfers,
  cashCounts,
  glAccounts,
}: CashAccountDetailClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [activeTab, setActiveTab] = useState<'transactions' | 'transfers' | 'counts'>('transactions')
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Transaction form state
  const [txnType, setTxnType] = useState<'cash_deposit' | 'cash_withdrawal'>('cash_deposit')
  const [amount, setAmount] = useState('')
  const [counterpartGlAccountId, setCounterpartGlAccountId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والمصارف' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    cashBreadcrumb: isAr ? 'الصناديق النقدية' : isTr ? 'Kasa Hesapları' : 'Cash Accounts',
    pettySubtitle: (custodian: string) =>
      isAr
        ? `عهدة نقدية للمصروفات النثرية (أمين العهدة: ${custodian})`
        : isTr
        ? `Küçük Kasa Avansı (Sorumlu: ${custodian})`
        : `Petty Cash Float (Custodian: ${custodian})`,
    generalSubtitle: isAr
      ? 'حساب الخزينة النقدية الرئيسية والصناديق التشغيلية'
      : isTr
      ? 'Fiziksel Ana Kasa ve Operasyonel Nakit Hesabı'
      : 'Physical Cash & Vault Account',
    unassigned: isAr ? 'غير محدد' : isTr ? 'Atanmamış' : 'Unassigned',
    transferBtn: isAr ? 'تحويل مالي' : isTr ? 'Para Transferi' : 'Transfer',
    countBtn: isAr ? 'جرد فعلي للنقد' : isTr ? 'Fiili Sayım' : 'Physical Count',
    postMovementBtn: isAr ? 'تسجيل حركة نقدية' : isTr ? 'Nakit Hareketi Kaydet' : 'Post Cash Movement',
    // Cards
    currentBalanceLabel: isAr ? 'الرصيد الدفتري الحالي' : isTr ? 'Güncel Defter Bakiyesi' : 'Current Ledger Balance',
    currencyLabel: isAr ? 'العملة:' : isTr ? 'Para Birimi:' : 'Currency:',
    mappedGlLabel: isAr ? 'حساب الأستاذ العام (GL)' : isTr ? 'Bağlı Muhasebe Hesabı (GL)' : 'Mapped GL Account',
    targetFloatLabel: isAr ? 'الحد المستهدف للعهدة' : isTr ? 'Hedef Avans Limiti' : 'Target Float Amount',
    custodianPrefix: isAr ? 'أمين العهدة:' : isTr ? 'Kasa Sorumlusu:' : 'Custodian:',
    none: isAr ? 'لا يوجد' : isTr ? 'Yok' : 'None',
    accountStatusLabel: isAr ? 'حالة الحساب' : isTr ? 'Hesap Durumu' : 'Account Status',
    activeStatus: isAr ? 'نشط وتشغيلي' : isTr ? 'Aktif ve Çalışıyor' : 'Active & Operational',
    disabledStatus: isAr ? 'معطل' : isTr ? 'Devre Dışı' : 'Disabled',
    createdDateLabel: isAr ? 'تاريخ الإنشاء:' : isTr ? 'Oluşturulma:' : 'Created:',
    // Tabs
    tabTxns: (count: number) =>
      isAr ? `الحركات والمعاملات النقدية (${count})` : isTr ? `İşlemler ve Hareketler (${count})` : `Transactions & Movements (${count})`,
    tabTransfers: (count: number) =>
      isAr ? `التحويلات الداخلية (${count})` : isTr ? `Dahili Transferler (${count})` : `Internal Transfers (${count})`,
    tabCounts: (count: number) =>
      isAr ? `عمليات الجرد الفعلي (${count})` : isTr ? `Fiili Kasa Sayımları (${count})` : `Physical Cash Counts (${count})`,
    // Empty states
    noTxns: isAr
      ? 'لا توجد حركات نقدية مسجلة لهذا الحساب حتى الآن. اضغط على "تسجيل حركة نقدية" لإضافة إيداع أو سحب.'
      : isTr
      ? 'Bu hesap için henüz kaydedilmiş işlem yok. Para girişi veya çıkışı kaydetmek için "Nakit Hareketi Kaydet" butonuna tıklayın.'
      : 'No recorded transactions for this account yet. Click "Post Cash Movement" to record a cash deposit or withdrawal.',
    noTransfers: isAr
      ? 'لا توجد تحويلات مالية داخلية مرتبطة بهذا الحساب.'
      : isTr
      ? 'Bu hesaba bağlı dahili para transferi bulunmamaktadır.'
      : 'No internal transfers linked to this account.',
    noCounts: isAr
      ? 'لا توجد عمليات جرد فعلي مسجلة لهذه العهدة النقدية بعد.'
      : isTr
      ? 'Bu küçük kasa için henüz kaydedilmiş fiili sayım bulunmamaktadır.'
      : 'No physical cash counts recorded for this petty cash float yet.',
    // Table Headers
    thDate: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    thType: isAr ? 'نوع الحركة' : isTr ? 'İşlem Türü' : 'Type',
    thDescription: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    thReference: isAr ? 'المرجع' : isTr ? 'Referans' : 'Reference',
    thAmount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    thGlStatus: isAr ? 'حالة الترحيل' : isTr ? 'Yevmiye Durumu' : 'GL Status',
    postedBadge: isAr ? 'مرحل' : isTr ? 'İşlendi' : 'Posted',
    draftBadge: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
    thTransferNum: isAr ? 'رقم التحويل' : isTr ? 'Transfer No' : 'Transfer #',
    thDirection: isAr ? 'الاتجاه والمسار' : isTr ? 'Yön' : 'Direction',
    thStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    outflowTo: (dest: string) => isAr ? `تحويل خارج إلى ${dest}` : isTr ? `${dest} hesabına çıkış` : `Outflow to ${dest}`,
    inflowFrom: (src: string) => isAr ? `تحويل وارد من ${src}` : isTr ? `${src} hesabından giriş` : `Inflow from ${src}`,
    thCountNum: isAr ? 'رقم الجرد' : isTr ? 'Sayım No' : 'Count #',
    thCountDate: isAr ? 'تاريخ الجرد' : isTr ? 'Sayım Tarihi' : 'Count Date',
    thSystemBook: isAr ? 'الرصيد الدفتري' : isTr ? 'Kayıtlı Bakiye' : 'System Book',
    thCountedCash: isAr ? 'النقد الفعلي المعدود' : isTr ? 'Sayılan Nakit' : 'Counted Cash',
    thVariance: isAr ? 'الفارق' : isTr ? 'Fark' : 'Variance',
    // Modal
    modalTitle: isAr ? 'تسجيل حركة نقدية بالصندوق' : isTr ? 'Nakit Hareketi Kaydet' : 'Post Cash Movement',
    movementTypeLabel: isAr ? 'نوع الحركة *' : isTr ? 'Hareket Türü *' : 'Movement Type *',
    depositOpt: isAr ? 'إيداع نقدي (وارد +)' : isTr ? 'Nakit Girişi (Giriş +)' : 'Cash Deposit (Inflow)',
    withdrawalOpt: isAr ? 'سحب نقدي (صادر -)' : isTr ? 'Nakit Çıkışı (Çıkış -)' : 'Cash Withdrawal (Outflow)',
    amountLabel: (curr: string) => isAr ? `المبلغ (${curr}) *` : isTr ? `Tutar (${curr}) *` : `Amount (${curr}) *`,
    dateLabel: isAr ? 'التاريخ *' : isTr ? 'Tarih *' : 'Date *',
    counterpartGlLabel: isAr ? 'الحساب المقابل في دليل الحسابات (اختياري)' : isTr ? 'Karşı Muhasebe Hesabı (İsteğe bağlı)' : 'Counterpart GL Account (Optional)',
    defaultCounterpart: isAr ? '-- الحساب الافتراضي التلقائي --' : isTr ? '-- Varsayılan Hesap --' : '-- Default Counterpart --',
    descLabel: isAr ? 'البيان / الوصف *' : isTr ? 'Açıklama / Not *' : 'Description / Memo *',
    descPlaceholder: isAr ? 'مثال: إيداع مبيعات اليوم، سلفة مشتريات نقدية، عهدة مصاريف' : isTr ? 'Örn: Günlük hasılat girişi, ofis harcaması avansı' : 'e.g. Daily store till collection, petty expense voucher',
    refLabel: isAr ? 'رقم السند / المرجع (اختياري)' : isTr ? 'Fiş / Makbuz No (İsteğe bağlı)' : 'Reference # (Optional)',
    refPlaceholder: isAr ? 'رقم السند أو الفاتورة...' : isTr ? 'Makbuz / Fatura No...' : 'Receipt / Voucher #',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    posting: isAr ? 'جارٍ التسجيل والترحيل...' : isTr ? 'İşleniyor...' : 'Posting...',
    submitBtn: isAr ? 'ترحيل الحركة النقدية' : isTr ? 'Hareketi Kaydet' : 'Post Cash Movement',
    errAmount: isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : isTr ? 'Geçerli pozitif bir tutar giriniz' : 'Valid positive amount is required',
    errDesc: isAr ? 'البيان مطلوب' : isTr ? 'Açıklama zorunludur' : 'Description is required',
    successMsg: isAr ? 'تم تسجيل وترحيل الحركة النقدية إلى دفتر الأستاذ العام بنجاح!' : isTr ? 'Nakit hareketi başarıyla büyük deftere işlendi!' : 'Transaction posted successfully with double-entry journal!',
    types: {
      cash_deposit: isAr ? 'إيداع نقدي' : isTr ? 'Nakit Girişi' : 'Cash Deposit',
      cash_withdrawal: isAr ? 'سحب نقدي' : isTr ? 'Nakit Çıkışı' : 'Cash Withdrawal',
    } as Record<string, string>,
  }

  const handlePostTxn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t.errAmount)
      return
    }
    if (!description.trim()) {
      toast.error(t.errDesc)
      return
    }

    setLoading(true)
    try {
      const res = await postTreasuryTransactionAction(businessId, {
        type: txnType,
        accountType: 'cash',
        accountId: account.id,
        amount: parseFloat(amount),
        date: new Date(date),
        counterpartGlAccountId: counterpartGlAccountId || undefined,
        reference: reference.trim() || undefined,
        description: description.trim(),
      })

      if (res.success) {
        toast.success(t.successMsg)
        setIsTxnModalOpen(false)
        setAmount('')
        setDescription('')
        setReference('')
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to post transaction')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Breadcrumb Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <Link href={`/b/${businessId}/treasury/cash`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.cashBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{account.name}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {account.isPettyCash ? <WalletCards size={26} className="text-warning" /> : <Coins size={26} className="text-brand-600" />}
            {account.name}
          </h1>
          <p className="page-subtitle">
            {account.isPettyCash ? t.pettySubtitle(account.custodianName || t.unassigned) : t.generalSubtitle}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/treasury/transfers`} className="btn btn-secondary">
            <ArrowLeftRight size={16} /> {t.transferBtn}
          </Link>
          {account.isPettyCash && (
            <Link href={`/b/${businessId}/treasury/petty-cash`} className="btn btn-secondary">
              <FileCheck size={16} /> {t.countBtn}
            </Link>
          )}
          <button className="btn btn-primary" onClick={() => setIsTxnModalOpen(true)}>
            <Receipt size={16} /> {t.postMovementBtn}
          </button>
        </div>
      </div>

      {/* KPI Cards for Account */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-brand-600)' }}>
          <div className="stat-card-label">{t.currentBalanceLabel}</div>
          <div className="stat-card-value" style={{ color: account.balance >= 0 ? 'var(--color-brand-600)' : 'var(--color-danger)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
            {formatCurrency(account.balance, account.currency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.currencyLabel} {account.currency}
          </div>
        </div>

        <div className="stat-card" style={{ borderInlineStart: '4px solid #0ea5e9' }}>
          <div className="stat-card-label">{t.mappedGlLabel}</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {account.glAccount.code}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {account.glAccount.name}
          </div>
        </div>

        {account.isPettyCash ? (
          <div className="stat-card" style={{ borderInlineStart: '4px solid #f59e0b' }}>
            <div className="stat-card-label">{t.targetFloatLabel}</div>
            <div className="stat-card-value" style={{ color: '#f59e0b', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
              {account.targetFloat ? formatCurrency(account.targetFloat, account.currency) : '—'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.custodianPrefix} {account.custodianName || t.none}
            </div>
          </div>
        ) : (
          <div className="stat-card" style={{ borderInlineStart: '4px solid #10b981' }}>
            <div className="stat-card-label">{t.accountStatusLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className={`badge ${account.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.875rem' }}>
                {account.isActive ? t.activeStatus : t.disabledStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.createdDateLabel} {new Date(account.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('transactions')}
          style={{
            padding: '0.75rem 0.25rem',
            borderBottom: activeTab === 'transactions' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            color: activeTab === 'transactions' ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          {t.tabTxns(transactions.length)}
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          style={{
            padding: '0.75rem 0.25rem',
            borderBottom: activeTab === 'transfers' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            color: activeTab === 'transfers' ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          {t.tabTransfers(transfers.length)}
        </button>
        {account.isPettyCash && (
          <button
            onClick={() => setActiveTab('counts')}
            style={{
              padding: '0.75rem 0.25rem',
              borderBottom: activeTab === 'counts' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
              color: activeTab === 'counts' ? 'var(--color-brand-600)' : 'var(--text-secondary)',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9375rem',
            }}
          >
            {t.tabCounts(cashCounts.length)}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {activeTab === 'transactions' && (
            transactions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noTxns}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <thead>
                    <tr>
                      <th>{t.thDate}</th>
                      <th>{t.thType}</th>
                      <th>{t.thDescription}</th>
                      <th>{t.thReference}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thAmount}</th>
                      <th>{t.thGlStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tItem) => {
                      const isPositive = tItem.type.includes('deposit') || tItem.type.includes('income')
                      const typeLabel = t.types[tItem.type] || tItem.type.replace('_', ' ')
                      return (
                        <tr key={tItem.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(tItem.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${isPositive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                              {typeLabel}
                            </span>
                          </td>
                          <td>{tItem.description}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{tItem.reference || '—'}</td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: isPositive ? 'var(--color-success)' : 'var(--color-danger)', direction: 'ltr' }}>
                            {isPositive ? '+' : '-'}{formatCurrency(tItem.amount, account.currency)}
                          </td>
                          <td>
                            {tItem.isPosted ? (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={12} /> {t.postedBadge}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">{t.draftBadge}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'transfers' && (
            transfers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noTransfers}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <thead>
                    <tr>
                      <th>{t.thTransferNum}</th>
                      <th>{t.thDate}</th>
                      <th>{t.thDirection}</th>
                      <th>{t.thReference}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thAmount}</th>
                      <th>{t.thStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr) => {
                      const isSource = tr.sourceAccountId === account.id
                      return (
                        <tr key={tr.id}>
                          <td style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>{tr.transferNumber}</td>
                          <td>{new Date(tr.transferDate).toLocaleDateString()}</td>
                          <td>
                            {isSource ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-danger)' }}>
                                <ArrowUpRight size={14} /> {t.outflowTo(tr.destinationAccountType === 'cash' ? (isAr ? 'خزينة' : 'cash') : (isAr ? 'بنك' : 'bank'))}
                              </span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-success)' }}>
                                <ArrowDownLeft size={14} /> {t.inflowFrom(tr.sourceAccountType === 'cash' ? (isAr ? 'خزينة' : 'cash') : (isAr ? 'بنك' : 'bank'))}
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{tr.reference || '—'}</td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, direction: 'ltr' }}>{formatCurrency(tr.amount, tr.currency)}</td>
                          <td>
                            <span className={`badge ${tr.status === 'posted' ? 'badge-success' : tr.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                              {tr.status === 'posted' ? (isAr ? 'مرحل' : 'posted') : tr.status === 'approved' ? (isAr ? 'معتمد' : 'approved') : (isAr ? 'مسودة' : 'draft')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'counts' && (
            cashCounts.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noCounts}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <thead>
                    <tr>
                      <th>{t.thCountNum}</th>
                      <th>{t.thCountDate}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thSystemBook}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thCountedCash}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thVariance}</th>
                      <th>{t.thStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashCounts.map((cc) => (
                      <tr key={cc.id}>
                        <td style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>{cc.countNumber}</td>
                        <td>{new Date(cc.countDate).toLocaleDateString()}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', direction: 'ltr' }}>{formatCurrency(cc.systemBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, direction: 'ltr' }}>{formatCurrency(cc.countedBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: cc.varianceAmount === 0 ? 'var(--color-success)' : 'var(--color-danger)', direction: 'ltr' }}>
                          {formatCurrency(cc.varianceAmount, account.currency)}
                        </td>
                        <td>
                          <span className={`badge ${cc.status === 'posted' ? 'badge-success' : cc.status === 'reviewed' ? 'badge-info' : 'badge-warning'}`}>
                            {cc.status === 'posted' ? (isAr ? 'مرحل' : 'posted') : cc.status === 'reviewed' ? (isAr ? 'مدقق' : 'reviewed') : (isAr ? 'تم الجرد' : 'counted')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      <Modal
        isOpen={isTxnModalOpen}
        onClose={() => setIsTxnModalOpen(false)}
        title={t.modalTitle}
      >
        <form onSubmit={handlePostTxn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.movementTypeLabel}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as any)}
              >
                <option value="cash_deposit">{t.depositOpt}</option>
                <option value="cash_withdrawal">{t.withdrawalOpt}</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.amountLabel(account.currency)}
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.dateLabel}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.counterpartGlLabel}
              </label>
              <AccountSearchSelect
                accounts={glAccounts}
                value={counterpartGlAccountId}
                onChange={(val) => setCounterpartGlAccountId(val)}
                placeholder={t.defaultCounterpart}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.descLabel}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              placeholder={t.descPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsTxnModalOpen(false)}
              disabled={loading}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.posting : t.submitBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
