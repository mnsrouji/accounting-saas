'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  Landmark,
  FileSpreadsheet,
  CheckCheck,
  ArrowLeftRight,
  Receipt,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/decimal'
import { Modal } from '@/components/ui/Modal'
import { postTreasuryTransactionAction } from '@/actions/treasury/treasury-actions'

interface BankAccountDetailClientProps {
  businessId: string
  defaultCurrency: string
  account: {
    id: string
    name: string
    bankName: string
    accountNumber: string
    iban: string | null
    swiftCode: string | null
    branch: string | null
    currency: string
    balance: number
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
  statements: Array<{
    id: string
    statementNumber: string
    startDate: string
    endDate: string
    openingBalance: number
    closingBalance: number
    totalDebit: number
    totalCredit: number
    lineCount: number
  }>
  reconciliations: Array<{
    id: string
    reconciliationNumber: string
    statementDate: string
    statementBalance: number
    bookBalance: number
    clearedBalance: number
    difference: number
    status: string
    matchCount: number
    adjustmentCount: number
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
  glAccounts: Array<{
    id: string
    code: string
    name: string
    type: string
  }>
}

export function BankAccountDetailClient({
  businessId,
  defaultCurrency,
  account,
  transactions,
  statements,
  reconciliations,
  transfers,
  glAccounts,
}: BankAccountDetailClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [activeTab, setActiveTab] = useState<'transactions' | 'statements' | 'reconciliations' | 'transfers'>('transactions')
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Transaction form state
  const [txnType, setTxnType] = useState<'bank_deposit' | 'bank_withdrawal' | 'bank_fee' | 'interest_income' | 'interest_expense' | 'adjustment'>('bank_deposit')
  const [amount, setAmount] = useState('')
  const [counterpartGlAccountId, setCounterpartGlAccountId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')

  const t = {
    treasury: isAr ? 'الخزينة والمصارف' : isTr ? 'Hazine ve Bankalar' : 'Treasury',
    bankAccounts: isAr ? 'الحسابات البنكية' : isTr ? 'Banka Hesapları' : 'Bank Accounts',
    accountDetails: isAr ? 'تفاصيل الحساب' : isTr ? 'Hesap Detayları' : 'Account Details',
    accNo: isAr ? 'رقم الحساب:' : isTr ? 'Hesap No:' : 'Acc:',
    branch: isAr ? 'الفرع:' : isTr ? 'Şube:' : 'Branch:',
    transfer: isAr ? 'تحويل مالي' : isTr ? 'Para Transferi' : 'Transfer',
    importStatement: isAr ? 'استيراد كشف حساب' : isTr ? 'Ekstre İçe Aktar' : 'Import Statement',
    reconcile: isAr ? 'تسوية بنكية' : isTr ? 'Mutabakat Yap' : 'Reconcile',
    postBankMovement: isAr ? 'تسجيل حركة بنكية' : isTr ? 'Banka Hareketi Ekle' : 'Post Bank Movement',
    
    // KPI cards
    currentBookBalance: isAr ? 'الرصيد الدفتري الحالي' : isTr ? 'Güncel Defter Bakiyesi' : 'Current Book Balance',
    currencyLabel: isAr ? 'العملة:' : isTr ? 'Para Birimi:' : 'Currency:',
    mappedGlAccount: isAr ? 'حساب الأستاذ العام المرتبط' : isTr ? 'Eşleşen Muhasebe Hesabı' : 'Mapped GL Account',
    bankingCoordinates: isAr ? 'البيانات المصرفية' : isTr ? 'Banka Bilgileri' : 'Banking Coordinates',
    iban: 'IBAN',
    swift: 'SWIFT',
    statementsAndRecon: isAr ? 'الكشوفات والتسويات' : isTr ? 'Ekstreler ve Mutabakat' : 'Statements & Recon',
    importedStatementsCount: isAr ? 'كشوف مستوردة' : isTr ? 'İçe Aktarılan Ekstre' : 'Imported Statements',
    reconciliationSessionsCount: isAr ? 'جلسات مطابقة' : isTr ? 'Mutabakat Oturumu' : 'Reconciliation Sessions',
    
    // Tabs
    tabTransactions: isAr ? 'حركات الدفتر' : isTr ? 'Defter Hareketleri' : 'Book Transactions',
    tabStatements: isAr ? 'كشوف الحسابات' : isTr ? 'Banka Ekstreleri' : 'Bank Statements',
    tabReconciliations: isAr ? 'جلسات التسوية' : isTr ? 'Mutabakatlar' : 'Reconciliations',
    tabTransfers: isAr ? 'التحويلات' : isTr ? 'Transferler' : 'Transfers',
    
    // Empty states
    noTransactions: isAr ? 'لا توجد حركات بنكية مسجلة لهذا الحساب حتى الآن. انقر على "تسجيل حركة بنكية" لإضافة عمولات، فوائد أو إيداعات.' : isTr ? 'Bu hesap için henüz kaydedilmiş banka işlemi yok. Ücret, faiz veya mevduat kaydetmek için "Banka Hareketi Ekle"ye tıklayın.' : 'No recorded bank transactions for this account yet. Click "Post Bank Movement" to record bank fees, interest, or direct deposits.',
    noStatements: isAr ? 'لم يتم تحميل أي كشف حساب بنكي لهذا الحساب بعد.' : isTr ? 'Bu hesap için yüklenmiş banka ekstresi bulunmamaktadır.' : 'No bank statements uploaded for this account.',
    noReconciliations: isAr ? 'لم يتم إجراء أي جلسات تسوية بنكية لهذا الحساب بعد.' : isTr ? 'Bu banka hesabı için henüz mutabakat işlemi yapılmamıştır.' : 'No reconciliation sessions performed for this bank account yet.',
    noTransfers: isAr ? 'لا توجد تحويلات داخلية مرتبطة بهذا الحساب البنكي.' : isTr ? 'Bu banka hesabına bağlı dahili transfer bulunmamaktadır.' : 'No internal transfers linked to this bank account.',
    
    // Table Headers
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    type: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    description: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    reference: isAr ? 'المرجع' : isTr ? 'Referans' : 'Reference',
    amount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    glStatus: isAr ? 'حالة القيد' : isTr ? 'Yevmiye Durumu' : 'GL Status',
    posted: isAr ? 'مرحّل' : isTr ? 'İşlendi' : 'Posted',
    draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
    
    // Statements Table
    statementNum: isAr ? 'رقم الكشف' : isTr ? 'Ekstre No' : 'Statement #',
    period: isAr ? 'الفترة' : isTr ? 'Dönem' : 'Period',
    opening: isAr ? 'الرصيد الافتتاحي' : isTr ? 'Açılış' : 'Opening',
    closing: isAr ? 'الرصيد الختامي' : isTr ? 'Kapanış' : 'Closing',
    debitsCredits: isAr ? 'المدين / الدائن' : isTr ? 'Borç / Alacak' : 'Debits / Credits',
    lines: isAr ? 'السطور' : isTr ? 'Satır Sayısı' : 'Lines',
    linesBadge: (cnt: number) => isAr ? `${cnt} سطر` : isTr ? `${cnt} satır` : `${cnt} lines`,
    
    // Reconciliations Table
    reconNum: isAr ? 'رقم التسوية' : isTr ? 'Mutabakat No' : 'Reconciliation #',
    statementDate: isAr ? 'تاريخ الكشف' : isTr ? 'Ekstre Tarihi' : 'Statement Date',
    statementBalance: isAr ? 'رصيد الكشف' : isTr ? 'Ekstre Bakiyesi' : 'Statement Balance',
    clearedBalance: isAr ? 'الرصيد المطابق' : isTr ? 'Eşleşen Bakiye' : 'Cleared Balance',
    difference: isAr ? 'الفارق' : isTr ? 'Fark' : 'Difference',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    statusClosed: isAr ? 'مغلقة' : isTr ? 'Kapalı' : 'closed',
    statusOpen: isAr ? 'قيد المعالجة' : isTr ? 'Açık' : 'open',
    
    // Transfers Table
    transferNum: isAr ? 'رقم التحويل' : isTr ? 'Transfer No' : 'Transfer #',
    direction: isAr ? 'الاتجاه' : isTr ? 'Yön' : 'Direction',
    outflowTo: (dest: string) => isAr ? `صادر إلى ${dest}` : isTr ? `${dest} hedefine çıkış` : `Outflow to ${dest}`,
    inflowFrom: (src: string) => isAr ? `وارد من ${src}` : isTr ? `${src} kaynağından giriş` : `Inflow from ${src}`,
    
    // Modal
    modalTitle: isAr ? 'تسجيل حركة بنكية' : isTr ? 'Banka Hareketi Ekle' : 'Post Bank Movement',
    movementType: isAr ? 'نوع الحركة *' : isTr ? 'Hareket Türü *' : 'Movement Type *',
    optBankDeposit: isAr ? 'إيداع بنكي (تدفق نقدي وارد)' : isTr ? 'Banka Mevduatı (Giriş)' : 'Bank Deposit (Inflow)',
    optBankWithdrawal: isAr ? 'سحب بنكي (تدفق نقدي صادر)' : isTr ? 'Banka Çekimi (Çıkış)' : 'Bank Withdrawal (Outflow)',
    optBankFee: isAr ? 'رسوم وعمولات بنكية (مصروف)' : isTr ? 'Banka Masrafı / Komisyon (Gider)' : 'Bank Fee / Service Charge (Expense)',
    optInterestIncome: isAr ? 'عوائد / فوائد دائنة (إيراد)' : isTr ? 'Faiz Geliri (Gelir)' : 'Interest Income (Revenue)',
    optInterestExpense: isAr ? 'فوائد مدينة (مصروف)' : isTr ? 'Faiz Gideri (Gider)' : 'Interest Expense (Expense)',
    optAdjustment: isAr ? 'تسوية وتعديل حساب بنكي' : isTr ? 'Hazine Düzeltmesi' : 'Treasury Adjustment',
    amountRequired: (cur: string) => isAr ? `المبلغ (${cur}) *` : isTr ? `Tutar (${cur}) *` : `Amount (${cur}) *`,
    dateRequired: isAr ? 'التاريخ *' : isTr ? 'Tarih *' : 'Date *',
    counterpartAccount: isAr ? 'حساب الأستاذ المقابل (اختياري)' : isTr ? 'Karşı Defter Hesabı (İsteğe Bağlı)' : 'Counterpart GL Account (Optional)',
    autoMatch: isAr ? '-- تحديد تلقائي حسب نوع الحركة --' : isTr ? '-- Türe Göre Otomatik Eşle --' : '-- Auto Match by Type --',
    descriptionRequired: isAr ? 'الوصف / البيان *' : isTr ? 'Açıklama *' : 'Description / Memo *',
    descriptionPlaceholder: isAr ? 'مثال: عمولة مصرفية شهرية، فوائد مكتسبة، تحويل بنكي' : isTr ? 'örn. Aylık hesap işletim ücreti, faiz geliri, havale' : 'e.g. Monthly maintenance charge, earned interest, wire deposit',
    referenceOptional: isAr ? 'رقم المرجع / الشيك (اختياري)' : isTr ? 'Referans / Çek No (İsteğe Bağlı)' : 'Reference # (Optional)',
    refPlaceholder: isAr ? 'رقم الحوالة / الإشعار البنكي / رقم الشيك' : isTr ? 'Havale Referansı / Çek No' : 'Wire Reference / Check #',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    submitting: isAr ? 'جاري التسجيل والترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...',
    submitBtn: isAr ? 'ترحيل الحركة إلى الأستاذ العام' : isTr ? 'Hareketi Kaydet ve İşle' : 'Post Bank Movement',
    
    // Types mapped
    types: {
      bank_deposit: isAr ? 'إيداع بنكي' : isTr ? 'Banka Girişi' : 'Bank Deposit',
      bank_withdrawal: isAr ? 'سحب بنكي' : isTr ? 'Banka Çıkışı' : 'Bank Withdrawal',
      bank_fee: isAr ? 'رسوم بنكية' : isTr ? 'Banka Masrafı' : 'Bank Fee',
      interest_income: isAr ? 'عوائد فوائد' : isTr ? 'Faiz Geliri' : 'Interest Income',
      interest_expense: isAr ? 'مصاريف فوائد' : isTr ? 'Faiz Gideri' : 'Interest Expense',
      adjustment: isAr ? 'تسوية' : isTr ? 'Düzeltme' : 'Adjustment',
    } as Record<string, string>,
  }

  const handlePostTxn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Valid positive amount is required')
      return
    }
    if (!description.trim()) {
      toast.error(isAr ? 'الوصف / البيان مطلوب' : 'Description is required')
      return
    }

    setLoading(true)
    try {
      const res = await postTreasuryTransactionAction(businessId, {
        type: txnType,
        accountType: 'bank',
        accountId: account.id,
        amount: parseFloat(amount),
        date: new Date(date),
        counterpartGlAccountId: counterpartGlAccountId || undefined,
        reference: reference.trim() || undefined,
        description: description.trim(),
      })

      if (res.success) {
        toast.success(isAr ? 'تم تسجيل الحركة البنكية وترحيلها بنجاح إلى دفتر الأستاذ العام!' : 'Bank movement recorded and posted to General Ledger!')
        setIsTxnModalOpen(false)
        setAmount('')
        setDescription('')
        setReference('')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل تسجيل الحركة' : 'Failed to post transaction'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ غير متوقع' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasury}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <Link href={`/b/${businessId}/treasury/banks`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.bankAccounts}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{account.name}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={26} className="text-brand-600" /> {account.name}
          </h1>
          <p className="page-subtitle">
            {account.bankName} {account.branch ? `• ${t.branch} ${account.branch}` : ''} • {t.accNo} {account.accountNumber}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/treasury/transfers`} className="btn btn-secondary">
            <ArrowLeftRight size={16} /> {t.transfer}
          </Link>
          <Link href={`/b/${businessId}/treasury/statements`} className="btn btn-secondary">
            <FileSpreadsheet size={16} /> {t.importStatement}
          </Link>
          <Link href={`/b/${businessId}/treasury/reconciliation`} className="btn btn-secondary">
            <CheckCheck size={16} /> {t.reconcile}
          </Link>
          <button className="btn btn-primary" onClick={() => setIsTxnModalOpen(true)}>
            <Receipt size={16} /> {t.postBankMovement}
          </button>
        </div>
      </div>

      {/* Account Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-brand-600)' }}>
          <div className="stat-card-label">{t.currentBookBalance}</div>
          <div className="stat-card-value" style={{ color: account.balance >= 0 ? 'var(--color-brand-600)' : 'var(--color-danger)' }}>
            {formatCurrency(account.balance, account.currency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.currencyLabel} {account.currency}
          </div>
        </div>

        <div className="stat-card" style={{ borderInlineStart: '4px solid #0ea5e9' }}>
          <div className="stat-card-label">{t.mappedGlAccount}</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {account.glAccount.code}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {account.glAccount.name}
          </div>
        </div>

        <div className="stat-card" style={{ borderInlineStart: '4px solid #10b981' }}>
          <div className="stat-card-label">{t.bankingCoordinates}</div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {account.iban ? <div><strong>{t.iban}:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{account.iban}</span></div> : null}
            {account.swiftCode ? <div><strong>{t.swift}:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{account.swiftCode}</span></div> : null}
            {!account.iban && !account.swiftCode && <div style={{ color: 'var(--text-muted)' }}>{t.accNo} {account.accountNumber}</div>}
          </div>
        </div>

        <div className="stat-card" style={{ borderInlineStart: '4px solid #8b5cf6' }}>
          <div className="stat-card-label">{t.statementsAndRecon}</div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            <div>{statements.length} {t.importedStatementsCount}</div>
            <div style={{ color: 'var(--text-secondary)' }}>{reconciliations.length} {t.reconciliationSessionsCount}</div>
          </div>
        </div>
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
          {t.tabTransactions} ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('statements')}
          style={{
            padding: '0.75rem 0.25rem',
            borderBottom: activeTab === 'statements' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            color: activeTab === 'statements' ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          {t.tabStatements} ({statements.length})
        </button>
        <button
          onClick={() => setActiveTab('reconciliations')}
          style={{
            padding: '0.75rem 0.25rem',
            borderBottom: activeTab === 'reconciliations' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            color: activeTab === 'reconciliations' ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          {t.tabReconciliations} ({reconciliations.length})
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
          {t.tabTransfers} ({transfers.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {activeTab === 'transactions' && (
            transactions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noTransactions}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.type}</th>
                      <th>{t.description}</th>
                      <th>{t.reference}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.amount}</th>
                      <th>{t.glStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => {
                      const isPositive = txn.type.includes('deposit') || txn.type.includes('income')
                      const typeLabel = t.types[txn.type] || txn.type.replace('_', ' ')
                      return (
                        <tr key={txn.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(txn.date).toLocaleDateString(locale)}</td>
                          <td>
                            <span className={`badge ${isPositive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                              {typeLabel}
                            </span>
                          </td>
                          <td>{txn.description}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{txn.reference || '—'}</td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {isPositive ? '+' : '-'}{formatCurrency(txn.amount, account.currency)}
                          </td>
                          <td>
                            {txn.isPosted ? (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={12} /> {t.posted}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">{t.draft}</span>
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

          {activeTab === 'statements' && (
            statements.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noStatements}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.statementNum}</th>
                      <th>{t.period}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.opening}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.closing}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.debitsCredits}</th>
                      <th>{t.lines}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((st) => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 600 }}>
                          <Link href={`/b/${businessId}/treasury/statements/${st.id}`} style={{ color: 'var(--color-brand-600)', textDecoration: 'none' }}>
                            {st.statementNumber}
                          </Link>
                        </td>
                        <td>{new Date(st.startDate).toLocaleDateString(locale)} — {new Date(st.endDate).toLocaleDateString(locale)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(st.openingBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(st.closingBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--color-danger)' }}>-{formatCurrency(st.totalDebit, account.currency)}</span>
                          {' / '}
                          <span style={{ color: 'var(--color-success)' }}>+{formatCurrency(st.totalCredit, account.currency)}</span>
                        </td>
                        <td><span className="badge badge-neutral">{t.linesBadge(st.lineCount)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'reconciliations' && (
            reconciliations.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noReconciliations}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.reconNum}</th>
                      <th>{t.statementDate}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.statementBalance}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.clearedBalance}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.difference}</th>
                      <th>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.map((rc) => (
                      <tr key={rc.id}>
                        <td style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>{rc.reconciliationNumber}</td>
                        <td>{new Date(rc.statementDate).toLocaleDateString(locale)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(rc.statementBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(rc.clearedBalance, account.currency)}</td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600, color: rc.difference === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {formatCurrency(rc.difference, account.currency)}
                        </td>
                        <td>
                          <span className={`badge ${rc.status === 'closed' ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {rc.status === 'closed' ? <Lock size={12} /> : <Unlock size={12} />} {rc.status === 'closed' ? t.statusClosed : t.statusOpen}
                          </span>
                        </td>
                      </tr>
                    ))}
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
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.transferNum}</th>
                      <th>{t.date}</th>
                      <th>{t.direction}</th>
                      <th>{t.reference}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.amount}</th>
                      <th>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr) => {
                      const isSource = tr.sourceAccountId === account.id
                      return (
                        <tr key={tr.id}>
                          <td style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>{tr.transferNumber}</td>
                          <td>{new Date(tr.transferDate).toLocaleDateString(locale)}</td>
                          <td>
                            {isSource ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-danger)' }}>
                                <ArrowUpRight size={14} /> {t.outflowTo(tr.destinationAccountType)}
                              </span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-success)' }}>
                                <ArrowDownLeft size={14} /> {t.inflowFrom(tr.sourceAccountType)}
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{tr.reference || '—'}</td>
                          <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(tr.amount, tr.currency)}</td>
                          <td>
                            <span className={`badge ${tr.status === 'posted' ? 'badge-success' : tr.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                              {tr.status}
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
                {t.movementType}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as any)}
              >
                <option value="bank_deposit">{t.optBankDeposit}</option>
                <option value="bank_withdrawal">{t.optBankWithdrawal}</option>
                <option value="bank_fee">{t.optBankFee}</option>
                <option value="interest_income">{t.optInterestIncome}</option>
                <option value="interest_expense">{t.optInterestExpense}</option>
                <option value="adjustment">{t.optAdjustment}</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.amountRequired(account.currency)}
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
                {t.dateRequired}
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
                {t.counterpartAccount}
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                value={counterpartGlAccountId}
                onChange={(e) => setCounterpartGlAccountId(e.target.value)}
              >
                <option value="">{t.autoMatch}</option>
                {glAccounts.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} - {g.name} ({g.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.descriptionRequired}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.referenceOptional}
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
              {loading ? t.submitting : t.submitBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
