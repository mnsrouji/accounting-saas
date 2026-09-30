'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Coins, WalletCards, Eye, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import { createCashAccountAction } from '@/actions/treasury/treasury-actions'

interface CashAccountRow {
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

interface CashAccountsClientProps {
  businessId: string
  defaultCurrency: string
  cashAccounts: CashAccountRow[]
  glAccounts: Array<{ id: string; code: string; name: string }>
}

export function CashAccountsClient({
  businessId,
  defaultCurrency,
  cashAccounts,
  glAccounts,
}: CashAccountsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [glAccountId, setGlAccountId] = useState(glAccounts[0]?.id || '')
  const [isPettyCash, setIsPettyCash] = useState(false)
  const [custodianName, setCustodianName] = useState('')
  const [targetFloat, setTargetFloat] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [description, setDescription] = useState('')

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    cashBreadcrumb: isAr ? 'حسابات الصناديق والخزينة' : isTr ? 'Kasa Hesapları' : 'Cash Accounts',
    title: isAr ? 'حسابات الخزينة والعهد النقدية' : isTr ? 'Kasa ve Avans Hesapları' : 'Cash & Petty Cash Accounts',
    subtitle: isAr
      ? 'إدارة الخزائن المركزية، الصناديق النقدية بالفروع، والعهد النقدية المسلمة للمشرفين'
      : isTr
      ? 'Fiziksel kasaları, mağaza yazarkasalarını ve personel avans fonlarını yönetin'
      : 'Manage physical cash registers, vaults, and custodian petty cash floats',
    transferFunds: isAr ? 'تحويل أموال' : isTr ? 'Para Transferi' : 'Transfer Funds',
    addCashAcc: isAr ? 'إضافة حساب خزينة' : isTr ? 'Yeni Kasa Hesabı' : 'Add Cash Account',
    colName: isAr ? 'اسم الحساب / الصندوق' : isTr ? 'Hesap Adı' : 'Account Name',
    colType: isAr ? 'نوع الحساب' : isTr ? 'Hesap Türü' : 'Account Type',
    pettyCash: isAr ? 'عهدة نقدية (Petty Cash)' : isTr ? 'Küçük Kasa / Avans' : 'Petty Cash',
    generalCash: isAr ? 'خزينة عامة' : isTr ? 'Genel Kasa' : 'General Cash',
    custodian: isAr ? 'أمين العهدة:' : isTr ? 'Kasa Sorumlusu:' : 'Custodian:',
    colGl: isAr ? 'حساب الأستاذ العام (GL)' : isTr ? 'Muhasebe Hesabı (GL)' : 'General Ledger Account',
    colCurrency: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    colBalance: isAr ? 'الرصيد الحالي' : isTr ? 'Güncel Bakiye' : 'Current Balance',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    active: isAr ? 'نشط' : isTr ? 'Aktif' : 'Active',
    inactive: isAr ? 'معطل' : isTr ? 'Pasif' : 'Inactive',
    colActions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    view: isAr ? 'عرض' : isTr ? 'Görüntüle' : 'View',
    searchPlaceholder: isAr ? 'بحث باسم الخزينة، أمين العهدة، أو الرمز...' : isTr ? 'Kasa adı, sorumlu veya koda göre ara...' : 'Search cash accounts by name, custodian, or code...',
    emptyTitle: isAr ? 'لا توجد حسابات خزينة مسجلة' : isTr ? 'Kayıtlı Kasa Hesabı Bulunamadı' : 'No cash accounts found',
    emptySubtext: isAr
      ? 'اضغط على "إضافة حساب خزينة" لتسجيل أول خزينة رئيسية أو عهدة نقدية.'
      : isTr
      ? 'İlk kasa veya avans hesabınızı kaydetmek için "Yeni Kasa Hesabı" butonuna tıklayın.'
      : "Click 'Add Cash Account' to register your first cash vault or petty cash float.",
    modalTitle: isAr ? 'إضافة حساب خزينة / عهدة جديد' : isTr ? 'Yeni Kasa / Avans Hesabı Tanımla' : 'Add New Cash Account',
    accNameLabel: isAr ? 'اسم الحساب / الخزينة *' : isTr ? 'Hesap Adı *' : 'Account Name *',
    accNamePlaceholder: isAr ? 'مثال: الخزينة الرئيسية، صندوق فرع 1، عهدة المشتريات' : isTr ? 'Örn: Merkez Kasa, Mağaza 1 Kasası, Ofis Avansı' : 'e.g. Main Vault, Store Register 1, Branch Petty Cash',
    currencyLabel: isAr ? 'عملة التعامل *' : isTr ? 'İşlem Para Birimi *' : 'Currency *',
    glAccLabel: isAr ? 'حساب شجرة الحسابات (الأصول) *' : isTr ? 'Hesap Planı Karşılığı (Varlık Hesabı) *' : 'General Ledger Asset Account *',
    glSearchPlaceholder: isAr ? '-- ابحث برقم أو اسم الحساب --' : isTr ? '-- Hesap Adı veya Kodu Ara --' : '-- Search by account code or name --',
    pettyCashCheck: isAr ? 'هذا الحساب عبارة عن عهدة نقدية (Petty Cash Float)' : isTr ? 'Bu hesap bir personel avans / küçük kasa hesabıdır' : 'This is a Petty Cash float account',
    custodianLabel: isAr ? 'اسم أمين العهدة المسؤول' : isTr ? 'Kasa Sorumlusu Adı' : 'Custodian Name',
    custodianPlaceholder: isAr ? 'مثال: مدير المكتب / مسؤول المشتريات' : isTr ? 'Örn: Ofis Müdürü / Satın Alma Sorumlusu' : 'e.g. Office Manager',
    targetFloatLabel: isAr ? 'الحد الأقصى المستهدف للعهدة (Target Float)' : isTr ? 'Hedef Avans Limiti' : 'Target Float Amount',
    openingBalLabel: (cur: string) =>
      isAr ? `الرصيد الافتتاحي (${cur})` : isTr ? `Açılış Bakiyesi (${cur})` : `Opening Balance (${cur})`,
    openingBalHint: isAr
      ? 'سيتم ترحيل قيد افتتاحي مزدوج متوازن تلقائياً في حال إدخال رصيد غير صفري.'
      : isTr
      ? 'Sıfırdan farklı bir açılış bakiyesi girilirse otomatik çift taraflı açılış yevmiyesi oluşturulur.'
      : 'Non-zero opening balances post a double-entry opening equity entry via AccountingService.',
    descLabel: isAr ? 'الوصف والملاحظات' : isTr ? 'Açıklama ve Notlar' : 'Description / Notes',
    descPlaceholder: isAr ? 'ملاحظات اختيارية أو الموقع الفيزيائي للخزينة...' : isTr ? 'İsteğe bağlı notlar veya fiziksel konum...' : 'Optional notes or physical location...',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    createBtn: isAr ? 'إنشاء الحساب' : isTr ? 'Hesabı Oluştur' : 'Create Cash Account',
    creatingBtn: isAr ? 'جاري الإنشاء...' : isTr ? 'Oluşturuluyor...' : 'Creating...',
    errNameReq: isAr ? 'اسم الحساب مطلوب' : isTr ? 'Hesap adı zorunludur' : 'Account name is required',
    errGlReq: isAr ? 'حساب الأستاذ العام مطلوب' : isTr ? 'Muhasebe hesabı zorunludur' : 'GL Account is required',
    successMsg: (n: string) =>
      isAr ? `تم إنشاء حساب الخزينة "${n}" بنجاح!` : isTr ? `"${n}" kasa hesabı başarıyla oluşturuldu!` : `Cash Account "${n}" created successfully!`,
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t.errNameReq)
      return
    }
    if (!glAccountId) {
      toast.error(t.errGlReq)
      return
    }

    setLoading(true)
    try {
      const res = await createCashAccountAction(businessId, {
        name: name.trim(),
        currency,
        glAccountId,
        isPettyCash,
        targetFloat: isPettyCash && targetFloat ? parseFloat(targetFloat) : undefined,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
      })

      if (res.success) {
        toast.success(t.successMsg(name))
        setIsModalOpen(false)
        setName('')
        setDescription('')
        setCustodianName('')
        setTargetFloat('')
        setOpeningBalance('')
        setIsPettyCash(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to create cash account')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<CashAccountRow>[] = [
    {
      key: 'name',
      header: t.colName,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/treasury/cash/${r.id}`}
            style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none' }}
          >
            {r.name}
          </Link>
          {r.description && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: t.colType,
      sortable: true,
      sortValue: (r) => (r.isPettyCash ? 'Petty Cash' : 'General Cash'),
      accessor: (r) => (
        <div>
          {r.isPettyCash ? (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <WalletCards size={12} /> {t.pettyCash}
            </span>
          ) : (
            <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Coins size={12} /> {t.generalCash}
            </span>
          )}
          {r.custodianName && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
              {t.custodian} {r.custodianName}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'glAccount',
      header: t.colGl,
      accessor: (r) => (
        <div>
          <span className="badge badge-neutral">{r.glAccount.code}</span>
          <span style={{ fontSize: '0.8125rem', marginInlineStart: '0.5rem', color: 'var(--text-secondary)' }}>
            {r.glAccount.name}
          </span>
        </div>
      ),
    },
    {
      key: 'currency',
      header: t.colCurrency,
      accessor: (r) => <span style={{ fontWeight: 500 }}>{r.currency}</span>,
    },
    {
      key: 'balance',
      header: t.colBalance,
      sortable: true,
      sortValue: (r) => r.balance,
      accessor: (r) => (
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: r.balance >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
          {formatCurrency(r.balance, r.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.colStatus,
      accessor: (r) => (
        <span className={`badge ${r.isActive ? 'badge-success' : 'badge-neutral'}`}>
          {r.isActive ? t.active : t.inactive}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.colActions,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            href={`/b/${businessId}/treasury/cash/${r.id}`}
            className="btn btn-ghost btn-sm"
            title={t.view}
          >
            <Eye size={14} /> {t.view}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.cashBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Coins size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/treasury/transfers`} className="btn btn-secondary">
            <ArrowLeftRight size={16} /> {t.transferFunds}
          </Link>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> {t.addCashAcc}
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-body">
          <DataTable
            data={cashAccounts}
            columns={columns}
            searchKey={(r) => `${r.name} ${r.custodianName || ''} ${r.glAccount.code}`}
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
          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.accNameLabel}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              placeholder={t.accNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
                <option value="AED">AED (د.إ)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {t.glAccLabel}
              </label>
              <AccountSearchSelect
                accounts={glAccounts}
                value={glAccountId}
                onChange={(val) => setGlAccountId(val)}
                placeholder={t.glSearchPlaceholder}
                required
              />
            </div>
          </div>

          {/* Petty Cash Toggle */}
          <div style={{ background: 'var(--bg-page)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={isPettyCash}
                onChange={(e) => setIsPettyCash(e.target.checked)}
              />
              {t.pettyCashCheck}
            </label>

            {isPettyCash && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {t.custodianLabel}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                    placeholder={t.custodianPlaceholder}
                    value={custodianName}
                    onChange={(e) => setCustodianName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {t.targetFloatLabel}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
                    placeholder="e.g. 1000.00"
                    value={targetFloat}
                    onChange={(e) => setTargetFloat(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.openingBalLabel(currency)}
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t.openingBalHint}
            </span>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {t.descLabel}
            </label>
            <textarea
              className="form-input"
              rows={2}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              placeholder={t.descPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {loading ? t.creatingBtn : t.createBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

