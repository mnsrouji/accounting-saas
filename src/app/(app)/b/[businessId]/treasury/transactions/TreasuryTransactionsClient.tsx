'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Receipt, Plus, ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, Coins, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import { postTreasuryTransactionAction } from '@/actions/treasury/treasury-actions'

interface TxnRow {
  id: string
  accountType: 'cash' | 'bank'
  accountId: string
  accountName: string
  currency: string
  type: string
  amount: number
  date: string
  description: string
  reference: string | null
  isPosted: boolean
  journalEntryId: string | null
}

interface TreasuryTransactionsClientProps {
  businessId: string
  defaultCurrency: string
  transactions: TxnRow[]
  cashAccounts: Array<{ id: string; name: string; currency: string; balance: number }>
  bankAccounts: Array<{ id: string; name: string; bankName: string; currency: string; balance: number }>
  glAccounts: Array<{ id: string; code: string; name: string; type: string }>
}

export function TreasuryTransactionsClient({
  businessId,
  defaultCurrency,
  transactions,
  cashAccounts,
  bankAccounts,
  glAccounts,
}: TreasuryTransactionsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [targetAccountType, setTargetAccountType] = useState<'cash' | 'bank'>('bank')
  const [targetAccountId, setTargetAccountId] = useState(bankAccounts[0]?.id || cashAccounts[0]?.id || '')
  const [txnType, setTxnType] = useState<'cash_deposit' | 'cash_withdrawal' | 'bank_deposit' | 'bank_withdrawal' | 'bank_fee' | 'interest_income' | 'interest_expense' | 'adjustment'>('bank_deposit')
  const [amount, setAmount] = useState('')
  const [counterpartGlAccountId, setCounterpartGlAccountId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    txnsBreadcrumb: isAr ? 'الحركات والمعاملات المالية' : isTr ? 'Kasa ve Banka İşlemleri' : 'Transactions',
    title: isAr ? 'حركات ومعاملات الخزينة والمصارف' : isTr ? 'Hazine, Kasa ve Banka İşlemleri' : 'Treasury & Cash Transactions',
    subtitle: isAr
      ? 'سجل المعاملات الموحد للإيداعات النقدية، المسحوبات، العمولات المصرفية، والفوائد مع الترحيل التلقائي'
      : isTr
      ? 'Nakit para yatırma, çekme, banka masrafları ve faiz işlemleri için birleşik işlem günlüğü'
      : 'Unified transaction ledger for cash, bank deposits, withdrawals, fees, and interest',
    postTxnBtn: isAr ? 'تسجيل حركة مالية' : isTr ? 'Yeni İşlem Kaydet' : 'Post Transaction',
    colDate: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    colAccount: isAr ? 'الحساب' : isTr ? 'Hesap' : 'Account',
    colType: isAr ? 'نوع المعاملة' : isTr ? 'İşlem Türü' : 'Transaction Type',
    colDesc: isAr ? 'البيان والمرجع' : isTr ? 'Açıklama ve Referans' : 'Description & Reference',
    colAmount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    colGlStatus: isAr ? 'حالة الترحيل' : isTr ? 'Yevmiye Durumu' : 'GL Status',
    refPrefix: isAr ? 'مرجع:' : isTr ? 'Ref:' : 'Ref:',
    postedBadge: isAr ? 'مرحل للأستاذ' : isTr ? 'İşlendi' : 'Posted',
    cashAccLabel: isAr ? 'حساب خزينة' : isTr ? 'Kasa Hesabı' : 'Cash Account',
    bankAccLabel: isAr ? 'حساب مصرفي' : isTr ? 'Banka Hesabı' : 'Bank Account',
    searchPlaceholder: isAr ? 'بحث بالبيان، المرجع، أو اسم الحساب...' : isTr ? 'Açıklama, referans veya hesap adına göre ara...' : 'Search transactions by description, reference, or account...',
    emptyTitle: isAr ? 'لا توجد حركات مالية مسجلة' : isTr ? 'Kayıtlı İşlem Yok' : 'No treasury transactions recorded yet',
    emptySubtext: isAr ? 'اضغط على "تسجيل حركة مالية" لتسجيل أول حركة إيداع أو سحب.' : isTr ? 'Kasa veya banka hareketi kaydetmek için "Yeni İşlem Kaydet" butonuna tıklayın.' : "Click 'Post Transaction' to record cash/bank movements.",
    modalTitle: isAr ? 'تسجيل حركة مالية وترحيلها للأستاذ' : isTr ? 'Hazine İşlemi Kaydet ve Muhasebeleştir' : 'Post Treasury Transaction',
    accTypeField: isAr ? 'نوع الحساب *' : isTr ? 'Hesap Türü *' : 'Account Type *',
    selectAccField: isAr ? 'اختر الحساب المعني *' : isTr ? 'İlgili Hesabı Seçin *' : 'Select Account *',
    txnTypeField: isAr ? 'نوع الحركة المالية *' : isTr ? 'İşlem Türü *' : 'Transaction Type *',
    amountField: isAr ? 'المبلغ *' : isTr ? 'İşlem Tutarı *' : 'Amount *',
    dateField: isAr ? 'تاريخ العملية *' : isTr ? 'İşlem Tarihi *' : 'Transaction Date *',
    counterpartGlField: isAr ? 'الحساب المقابل في شجرة الحسابات (GL)' : isTr ? 'Karşı Muhasebe Hesabı (GL)' : 'Counterpart GL Account',
    counterpartGlPlaceholder: isAr ? '-- مطابقة تلقائية أو ابحث بالاسم/الكود --' : isTr ? '-- Otomatik veya Arama Yapın --' : '-- Automatic match or search by name/code --',
    descField: isAr ? 'البيان / الوصف المحاسبي *' : isTr ? 'Açıklama / Muhasebe Notu *' : 'Description / Memo *',
    descPlaceholder: isAr ? 'مثال: عمولات تحويل بنكي، إيداع مبيعات اليوم، فائدة حساب التوفير' : isTr ? 'Örn: Havale masrafı, günlük mağaza hasılatı, mevduat faiz geliri' : 'e.g. Wire transfer fee, daily store settlement, monthly bank interest',
    refField: isAr ? 'رقم الإيصال / المرجع (اختياري)' : isTr ? 'Fiş / Dekont / Referans No' : 'Reference # (Optional)',
    refPlaceholder: isAr ? 'رقم الإيصال / الشيك / الحوالة' : isTr ? 'Makbuz / Çek / Havale No' : 'Receipt / Check / Wire ID',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    postBtn: isAr ? 'ترحيل للأستاذ العام' : isTr ? 'Yevmiyeye Kaydet' : 'Post to General Ledger',
    posting: isAr ? 'جارٍ الترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...',
    types: {
      bank_deposit: isAr ? 'إيداع بنكي (وارد +)' : isTr ? 'Banka Para Yatırma (Giriş +)' : 'Bank Deposit (Inflow)',
      bank_withdrawal: isAr ? 'سحب بنكي (صادر -)' : isTr ? 'Banka Para Çekme (Çıkış -)' : 'Bank Withdrawal (Outflow)',
      bank_fee: isAr ? 'مصاريف وعمولات بنكية (مصروف)' : isTr ? 'Banka Masraf ve Komisyonu (Gider)' : 'Bank Fee / Charges (Expense)',
      interest_income: isAr ? 'إيرادات فوائد بنكية (إيراد)' : isTr ? 'Faiz Geliri (Gelir)' : 'Interest Income (Revenue)',
      interest_expense: isAr ? 'مصاريف فوائد بنكية (مصروف)' : isTr ? 'Faiz Gideri (Gider)' : 'Interest Expense (Expense)',
      cash_deposit: isAr ? 'إيداع نقدي بالخزينة (وارد +)' : isTr ? 'Kasaya Para Girişi (Giriş +)' : 'Cash Deposit (Inflow)',
      cash_withdrawal: isAr ? 'سحب نقدي من الخزينة (صادر -)' : isTr ? 'Kasadan Para Çıkışı (Çıkış -)' : 'Cash Withdrawal (Outflow)',
      adjustment: isAr ? 'تسوية خزينة / حساب' : isTr ? 'Kasa / Banka Düzeltmesi' : 'Treasury Adjustment',
    },
  }

  const handleAccountTypeChange = (type: 'cash' | 'bank') => {
    setTargetAccountType(type)
    if (type === 'cash') {
      setTargetAccountId(cashAccounts[0]?.id || '')
      setTxnType('cash_deposit')
    } else {
      setTargetAccountId(bankAccounts[0]?.id || '')
      setTxnType('bank_deposit')
    }
  }

  const handlePostTxn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetAccountId) {
      toast.error(isAr ? 'يرجى اختيار حساب' : 'Please select an account')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(isAr ? 'المبلغ يجب أن يكون أكبر من الصفر' : 'Valid positive amount is required')
      return
    }
    if (!description.trim()) {
      toast.error(isAr ? 'البيان مطلوب' : 'Description is required')
      return
    }

    setLoading(true)
    try {
      const res = await postTreasuryTransactionAction(businessId, {
        type: txnType,
        accountType: targetAccountType,
        accountId: targetAccountId,
        amount: parseFloat(amount),
        date: new Date(date),
        counterpartGlAccountId: counterpartGlAccountId || undefined,
        reference: reference.trim() || undefined,
        description: description.trim(),
      })

      if (res.success) {
        toast.success(isAr ? 'تم ترحيل الحركة المالية إلى الأستاذ العام بنجاح!' : 'Transaction posted successfully to General Ledger!')
        setIsModalOpen(false)
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

  const columns: Column<TxnRow>[] = [
    {
      key: 'date',
      header: t.colDate,
      sortable: true,
      sortValue: (r) => r.date,
      accessor: (r) => <span style={{ whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString()}</span>,
    },
    {
      key: 'account',
      header: t.colAccount,
      sortable: true,
      sortValue: (r) => r.accountName,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/treasury/${r.accountType === 'cash' ? 'cash' : 'banks'}/${r.accountId}`}
            style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {r.accountType === 'cash' ? <Coins size={14} /> : <Landmark size={14} />}
            {r.accountName}
          </Link>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {r.accountType === 'cash' ? t.cashAccLabel : t.bankAccLabel}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      header: t.colType,
      sortable: true,
      sortValue: (r) => r.type,
      accessor: (r) => {
        const isPositive = r.type.includes('deposit') || r.type.includes('income')
        const label = (t.types as any)[r.type] || r.type.replace(/_/g, ' ')
        return (
          <span className={`badge ${isPositive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'description',
      header: t.colDesc,
      accessor: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.description}</div>
          {r.reference && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.refPrefix} {r.reference}</div>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: t.colAmount,
      sortable: true,
      sortValue: (r) => r.amount,
      accessor: (r) => {
        const isPositive = r.type.includes('deposit') || r.type.includes('income')
        return (
          <div style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 700, direction: 'ltr', color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {isPositive ? '+' : '-'}{formatCurrency(r.amount, r.currency)}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: t.colGlStatus,
      accessor: (r) => (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <CheckCircle2 size={12} /> {t.postedBadge}
        </span>
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
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.txnsBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> {t.postTxnBtn}
        </button>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-body">
          <DataTable
            data={transactions}
            columns={columns}
            searchKey={(r) => `${r.description} ${r.reference || ''} ${r.accountName} ${r.type}`}
            searchPlaceholder={t.searchPlaceholder}
            emptyTitle={t.emptyTitle}
            emptySubtext={t.emptySubtext}
          />
        </div>
      </div>

      {/* Post Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t.modalTitle}
      >
        <form onSubmit={handlePostTxn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Account Category Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.accTypeField}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleAccountTypeChange('bank')}
                  className={`btn btn-sm ${targetAccountType === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  <Landmark size={14} /> {t.bankAccLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleAccountTypeChange('cash')}
                  className={`btn btn-sm ${targetAccountType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  <Coins size={14} /> {t.cashAccLabel}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.selectAccField}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                required
              >
                {targetAccountType === 'bank'
                  ? bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.bankName} - {b.currency})
                      </option>
                    ))
                  : cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.txnTypeField}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as any)}
              >
                {targetAccountType === 'bank' ? (
                  <>
                    <option value="bank_deposit">{t.types.bank_deposit}</option>
                    <option value="bank_withdrawal">{t.types.bank_withdrawal}</option>
                    <option value="bank_fee">{t.types.bank_fee}</option>
                    <option value="interest_income">{t.types.interest_income}</option>
                    <option value="interest_expense">{t.types.interest_expense}</option>
                    <option value="adjustment">{t.types.adjustment}</option>
                  </>
                ) : (
                  <>
                    <option value="cash_deposit">{t.types.cash_deposit}</option>
                    <option value="cash_withdrawal">{t.types.cash_withdrawal}</option>
                    <option value="adjustment">{t.types.adjustment}</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.amountField}
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
                {t.dateField}
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
                {t.counterpartGlField}
              </label>
              <AccountSearchSelect
                accounts={glAccounts}
                value={counterpartGlAccountId}
                onChange={(val) => setCounterpartGlAccountId(val)}
                placeholder={t.counterpartGlPlaceholder}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.descField}
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
              {t.refField}
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
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.posting : t.postBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
