'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Landmark, Eye, CheckCircle2, FileSpreadsheet, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import { createBankAccountAction } from '@/actions/treasury/treasury-actions'

interface BankAccountRow {
  id: string
  name: string
  bankName: string
  accountNumber: string
  iban: string | null
  swiftCode: string | null
  branch: string | null
  currency: string
  balance: number
  isActive: boolean
  glAccount: {
    id: string
    code: string
    name: string
  }
  lastStatementDate: string | null
  lastReconciliationStatus: string | null
  createdAt: string
}

interface BankAccountsClientProps {
  businessId: string
  defaultCurrency: string
  bankAccounts: BankAccountRow[]
  glAccounts: Array<{ id: string; code: string; name: string }>
}

export function BankAccountsClient({
  businessId,
  defaultCurrency,
  bankAccounts,
  glAccounts,
}: BankAccountsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [iban, setIban] = useState('')
  const [swiftCode, setSwiftCode] = useState('')
  const [branch, setBranch] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [glAccountId, setGlAccountId] = useState(glAccounts[0]?.id || '')
  const [openingBalance, setOpeningBalance] = useState('')
  const [description, setDescription] = useState('')

  const t = {
    title: isAr ? 'الحسابات البنكية' : isTr ? 'Banka Hesapları' : 'Commercial Bank Accounts',
    subtitle: isAr
      ? 'إدارة الحسابات البنكية، كشوفات الحساب، والمطابقة والتسوية البنكية'
      : isTr
      ? 'Banka hesaplarını, ekstreleri ve banka mutabakatını yönetin'
      : 'Operating accounts, IBAN/SWIFT coordinates, electronic feeds, and reconciliations',
    registerAccount: isAr ? 'إضافة حساب بنكي' : isTr ? 'Yeni Banka Hesabı' : 'Register Bank Account',
    reconcileBtn: isAr ? 'المطابقة والتسوية البنكية' : isTr ? 'Banka Mutabakatı' : 'Reconciliation Workspace',
    accountAndBank: isAr ? 'اسم الحساب والبنك' : isTr ? 'Hesap ve Banka Adı' : 'Account & Bank',
    accountIban: isAr ? 'رقم الحساب / IBAN' : isTr ? 'Hesap No / IBAN' : 'Account / IBAN',
    glAccount: isAr ? 'حساب الأستاذ العام (GL)' : isTr ? 'Muhasebe Hesabı (GL)' : 'GL Asset Account',
    currencyLabel: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    balance: isAr ? 'الرصيد الدفتري' : isTr ? 'Kayıtlı Bakiye' : 'Book Balance',
    lastStatement: isAr ? 'آخر كشف / تسوية' : isTr ? 'Son Ekstre / Mutabakat' : 'Last Statement / Recon',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    view: isAr ? 'عرض' : isTr ? 'Görüntüle' : 'View',
    searchPlaceholder: isAr ? 'بحث باسم الحساب، البنك، أو الآيبان...' : isTr ? 'Hesap adı, banka veya IBAN ara...' : 'Search by account name, bank, IBAN, or SWIFT...',
    emptyTitle: isAr ? 'لا توجد حسابات بنكية مسجلة' : isTr ? 'Kayıtlı Banka Hesabı Yok' : 'No commercial bank accounts registered yet',
    emptySubtext: isAr ? 'اضغط على زر "إضافة حساب بنكي" لإنشاء أول حساب بنكي لمنشأتك.' : isTr ? 'İlk banka hesabınızı eklemek için "Yeni Banka Hesabı" butonuna tıklayın.' : "Click 'Register Bank Account' to add your first bank account.",
    modalTitle: isAr ? 'تسجيل حساب بنكي جديد' : isTr ? 'Yeni Banka Hesabı Tanımla' : 'Register Commercial Bank Account',
    accDisplayName: isAr ? 'الاسم التعريفي للحساب *' : isTr ? 'Hesap Görünüm Adı *' : 'Account Display Name *',
    bankNameField: isAr ? 'اسم المصرف / البنك *' : isTr ? 'Banka Adı *' : 'Bank Name *',
    accNumberField: isAr ? 'رقم الحساب البنكي *' : isTr ? 'Hesap Numarası *' : 'Account Number *',
    branchField: isAr ? 'الفرع / المدينة' : isTr ? 'Şube / Konum' : 'Branch / Location',
    glAccountField: isAr ? 'حساب شجرة الحسابات (الأصول) *' : isTr ? 'Hesap Planı Karşılığı (Varlık Hesabı) *' : 'General Ledger Asset Account *',
    openingBalField: isAr ? 'الرصيد الافتتاحي (اختياري)' : isTr ? 'Açılış Bakiyesi (İsteğe bağlı)' : 'Opening Balance (Optional)',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    save: isAr ? 'حفظ الحساب البنكي' : isTr ? 'Hesabı Kaydet' : 'Save Bank Account',
    saving: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !bankName.trim() || !accountNumber.trim()) {
      toast.error(isAr ? 'اسم الحساب والبنك ورقم الحساب حقول إلزامية' : isTr ? 'Hesap adı, banka adı ve hesap numarası zorunludur' : 'Account Name, Bank Name, and Account Number are required')
      return
    }
    if (!glAccountId) {
      toast.error(isAr ? 'حساب الأستاذ العام مطلوب' : isTr ? 'Muhasebe hesabı seçilmelidir' : 'General Ledger Account is required')
      return
    }

    setLoading(true)
    try {
      const res = await createBankAccountAction(businessId, {
        name: name.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        iban: iban.trim() || undefined,
        swiftCode: swiftCode.trim() || undefined,
        branch: branch.trim() || undefined,
        currency,
        glAccountId,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
      })

      if (res.success) {
        toast.success(isAr ? `تم تسجيل الحساب البنكي "${name}" بنجاح!` : isTr ? `"${name}" banka hesabı başarıyla kaydedildi!` : `Bank Account "${name}" registered successfully!`)
        setIsModalOpen(false)
        setName('')
        setBankName('')
        setAccountNumber('')
        setIban('')
        setSwiftCode('')
        setBranch('')
        setOpeningBalance('')
        setDescription('')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل في إنشاء الحساب البنكي' : isTr ? 'Hesap oluşturulamadı' : 'Failed to create bank account'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<BankAccountRow>[] = [
    {
      key: 'name',
      header: t.accountAndBank,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/treasury/banks/${r.id}`}
            style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none' }}
          >
            {r.name}
          </Link>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {r.bankName} {r.branch ? `(${r.branch})` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'accountNumber',
      header: t.accountIban,
      accessor: (r) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{isAr ? 'رقم:' : isTr ? 'No:' : 'Acc:'}</span> {r.accountNumber}</div>
          {r.iban && <div><span style={{ color: 'var(--text-muted)' }}>IBAN:</span> {r.iban}</div>}
          {r.swiftCode && <div><span style={{ color: 'var(--text-muted)' }}>SWIFT:</span> {r.swiftCode}</div>}
        </div>
      ),
    },
    {
      key: 'glAccount',
      header: t.glAccount,
      accessor: (r) => (
        <div>
          <span className="badge badge-neutral">{r.glAccount.code}</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            {r.glAccount.name}
          </div>
        </div>
      ),
    },
    {
      key: 'currency',
      header: t.currencyLabel,
      accessor: (r) => <span style={{ fontWeight: 500 }}>{r.currency}</span>,
    },
    {
      key: 'balance',
      header: t.balance,
      sortable: true,
      sortValue: (r) => r.balance,
      accessor: (r) => (
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: r.balance >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
          {formatCurrency(r.balance, r.currency)}
        </span>
      ),
    },
    {
      key: 'reconciliation',
      header: t.lastStatement,
      accessor: (r) => (
        <div style={{ fontSize: '0.8125rem' }}>
          {r.lastStatementDate ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              {new Date(r.lastStatementDate).toLocaleDateString()}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>{isAr ? 'لا توجد كشوفات' : isTr ? 'Ekstre yok' : 'No statements'}</div>
          )}
          {r.lastReconciliationStatus && (
            <span className={`badge ${r.lastReconciliationStatus === 'closed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', marginTop: '0.125rem' }}>
              {r.lastReconciliationStatus}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t.actions,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <Link
            href={`/b/${businessId}/treasury/banks/${r.id}`}
            className="btn btn-ghost btn-sm"
            title={t.view}
          >
            <Eye size={14} /> {t.view}
          </Link>
          <Link
            href={`/b/${businessId}/treasury/statements`}
            className="btn btn-ghost btn-sm"
            title={isAr ? 'كشوفات الحساب' : isTr ? 'Hesap Ekstreleri' : 'Statements'}
          >
            <FileSpreadsheet size={14} />
          </Link>
          <Link
            href={`/b/${businessId}/treasury/reconciliation`}
            className="btn btn-ghost btn-sm"
            title={isAr ? 'مطابقة' : isTr ? 'Mutabakat' : 'Reconcile'}
          >
            <CheckCheck size={14} />
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/treasury/reconciliation`} className="btn btn-secondary">
            <CheckCheck size={16} /> {t.reconcileBtn}
          </Link>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> {t.registerAccount}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-body">
          <DataTable
            data={bankAccounts}
            columns={columns}
            searchKey={(r) => `${r.name} ${r.bankName} ${r.accountNumber} ${r.iban || ''} ${r.swiftCode || ''}`}
            searchPlaceholder={t.searchPlaceholder}
            emptyTitle={t.emptyTitle}
            emptySubtext={t.emptySubtext}
          />
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t.modalTitle}
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.accDisplayName}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. Chase Operating Account / الراجحي رئيسي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.bankNameField}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. Al Rajhi, Chase, Garanti BBVA"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.accNumberField}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. 9876543210"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.branchField}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. Main Branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                IBAN
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. SA0380000000608010167519"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                SWIFT / BIC
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="e.g. RJHISARI"
                value={swiftCode}
                onChange={(e) => setSwiftCode(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.openingBalField}
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.saving : t.save}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
