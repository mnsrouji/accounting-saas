'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  BookOpen,
  Check,
  Filter,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Power,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { ChartOfAccountsExcelModal } from '@/components/accounting/ChartOfAccountsExcelModal'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'
import { getLocalizedAccountName, getLocalizedAccountDescription } from '@/lib/i18n/account-i18n'
import {
  createChartOfAccountAction,
  updateChartOfAccountAction,
  checkAccountDeletabilityAction,
  deleteChartOfAccountAction,
  toggleChartOfAccountStatusAction,
  syncStandardChartOfAccountsAction,
} from '@/actions/accounting/accounting-actions'
import { Sparkles, ShieldCheck } from 'lucide-react'

export interface AccountItem {
  id: string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: 'debit' | 'credit'
  parentId: string | null
  currency: string | null
  description: string | null
  isHeader: boolean
  isSystem: boolean
  isActive: boolean
  sortOrder: number
}

interface ChartOfAccountsClientProps {
  businessId: string
  defaultCurrency: string
  accounts: AccountItem[]
}

const ACCOUNT_TYPES: { key: AccountItem['type']; label: string; defaultBalance: 'debit' | 'credit' }[] = [
  { key: 'asset', label: 'Assets', defaultBalance: 'debit' },
  { key: 'liability', label: 'Liabilities', defaultBalance: 'credit' },
  { key: 'equity', label: 'Equity', defaultBalance: 'credit' },
  { key: 'revenue', label: 'Revenue', defaultBalance: 'credit' },
  { key: 'expense', label: 'Expenses', defaultBalance: 'debit' },
]

export function ChartOfAccountsClient({
  businessId,
  defaultCurrency,
  accounts: initialAccounts,
}: ChartOfAccountsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all')

  // Keep state synchronized with server props when refreshed
  useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Handle Smart Sync Standard Chart of Accounts
  const handleSyncStandardCOA = async () => {
    setIsSyncing(true)
    try {
      const res = await syncStandardChartOfAccountsAction(businessId)
      if (res.success) {
        toast.success(
          isAr
            ? `تمت مزامنة وتحديث الشجرة بنجاح! تم إنشاء (${res.createdCount}) حساب وتحديث (${res.updatedCount}) حساب.`
            : `Chart of Accounts synchronized! (${res.createdCount} created, ${res.updatedCount} updated)`
        )
        const formatted: AccountItem[] = (res.accounts || []).map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type as AccountItem['type'],
          normalBalance: a.normalBalance as 'debit' | 'credit',
          parentId: a.parentId,
          currency: a.currency,
          description: a.description,
          isHeader: a.isHeader,
          isSystem: a.isSystem,
          isActive: a.isActive,
          sortOrder: a.sortOrder,
        }))
        setAccounts(formatted)
        setIsSyncModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل في مزامنة الشجرة القياسية' : 'Failed to sync standard chart of accounts'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during synchronization')
    } finally {
      setIsSyncing(false)
    }
  }

  // Delete modal state
  const [accountToDelete, setAccountToDelete] = useState<AccountItem | null>(null)
  const [checkingDeletability, setCheckingDeletability] = useState(false)
  const [deletabilityInfo, setDeletabilityInfo] = useState<{
    canDelete: boolean
    transactionCount: number
    childrenCount: number
    linkedCount: number
    blockingReasons: string[]
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Form states for Add / Edit
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountItem['type']>('asset')
  const [normalBalance, setNormalBalance] = useState<'debit' | 'credit'>('debit')
  const [parentId, setParentId] = useState<string>('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [description, setDescription] = useState('')
  const [isHeader, setIsHeader] = useState(false)
  const [isActive, setIsActive] = useState(true)

  // Auto-switch normal balance when type changes in Create mode
  const handleTypeChange = (newType: AccountItem['type']) => {
    setType(newType)
    const match = ACCOUNT_TYPES.find((t) => t.key === newType)
    if (match) {
      setNormalBalance(match.defaultBalance)
    }
  }

  // Open Create Modal
  const handleOpenAdd = (presetType?: AccountItem['type']) => {
    const targetType = presetType || 'asset'
    setCode('')
    setName('')
    setType(targetType)
    const match = ACCOUNT_TYPES.find((t) => t.key === targetType)
    setNormalBalance(match ? match.defaultBalance : 'debit')
    setParentId('')
    setCurrency(defaultCurrency)
    setDescription('')
    setIsHeader(false)
    setIsActive(true)
    setIsAddOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (acc: AccountItem) => {
    setEditingAccountId(acc.id)
    setCode(acc.code)
    setName(acc.name)
    setType(acc.type)
    setNormalBalance(acc.normalBalance)
    setParentId(acc.parentId || '')
    setCurrency(acc.currency || defaultCurrency)
    setDescription(acc.description || '')
    setIsHeader(acc.isHeader)
    setIsActive(acc.isActive)
    setIsEditOpen(true)
  }

  // Open Delete Verification Modal
  const handleOpenDelete = async (acc: AccountItem) => {
    setAccountToDelete(acc)
    setDeletabilityInfo(null)
    setIsDeleteModalOpen(true)
    setCheckingDeletability(true)

    try {
      const res = await checkAccountDeletabilityAction(businessId, acc.id)
      if (res.success) {
        setDeletabilityInfo({
          canDelete: res.canDelete,
          transactionCount: res.transactionCount,
          childrenCount: res.childrenCount,
          linkedCount: res.linkedCount,
          blockingReasons: res.blockingReasons || [],
        })
      } else {
        toast.error(res.error || 'فشل في فحص حركات وسجلات الحساب')
        setIsDeleteModalOpen(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء فحص الحساب')
      setIsDeleteModalOpen(false)
    } finally {
      setCheckingDeletability(false)
    }
  }

  // Execute Permanent Delete (when zero transactions and zero children)
  const handleConfirmDelete = async () => {
    if (!accountToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteChartOfAccountAction(businessId, accountToDelete.id)
      if (res.success) {
        toast.success(`تم حذف الحساب "${accountToDelete.name}" (${accountToDelete.code}) بنجاح!`)
        setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id))
        setIsDeleteModalOpen(false)
        setAccountToDelete(null)
        router.refresh()
      } else {
        toast.error(res.error || 'تعذر حذف الحساب')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع أثناء الحذف')
    } finally {
      setIsDeleting(false)
    }
  }

  // Execute Toggle Active Status (for accounts with transactions)
  const handleToggleStatus = async () => {
    if (!accountToDelete) return
    setIsTogglingStatus(true)
    const newStatus = !accountToDelete.isActive
    try {
      const res = await toggleChartOfAccountStatusAction(businessId, accountToDelete.id, newStatus)
      if (res.success) {
        toast.success(`تم ${newStatus ? 'تفعيل' : 'تعطيل'} الحساب "${accountToDelete.name}" بنجاح!`)
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountToDelete.id ? { ...a, isActive: newStatus } : a))
        )
        setAccountToDelete((prev) => (prev ? { ...prev, isActive: newStatus } : null))
        setIsDeleteModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || 'تعذر تعديل حالة الحساب')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تعديل الحالة')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  // Submit Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim()) {
      toast.error('Account code is required')
      return
    }
    if (!name.trim()) {
      toast.error('Account name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await createChartOfAccountAction(businessId, {
        code: code.trim(),
        name: name.trim(),
        type,
        normalBalance,
        parentId: parentId || null,
        currency: currency || null,
        description: description.trim() || null,
        isHeader,
        isActive,
      })

      if (res.success) {
        toast.success(`Account "${res.account.name}" (${res.account.code}) created successfully!`)
        const newAcc: AccountItem = {
          id: res.account.id,
          code: res.account.code,
          name: res.account.name,
          type: res.account.type as AccountItem['type'],
          normalBalance: res.account.normalBalance as 'debit' | 'credit',
          parentId: res.account.parentId,
          currency: res.account.currency,
          description: res.account.description,
          isHeader: res.account.isHeader,
          isSystem: res.account.isSystem,
          isActive: res.account.isActive,
          sortOrder: res.account.sortOrder,
        }
        setAccounts((prev) => [...prev, newAcc].sort((a, b) => a.code.localeCompare(b.code)))
        setIsAddOpen(false)
      } else {
        toast.error(res.error || 'Failed to create account')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Edit Account
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingAccountId) return
    if (!code.trim()) {
      toast.error('Account code is required')
      return
    }
    if (!name.trim()) {
      toast.error('Account name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await updateChartOfAccountAction(businessId, {
        accountId: editingAccountId,
        code: code.trim(),
        name: name.trim(),
        type,
        normalBalance,
        parentId: parentId || null,
        currency: currency || null,
        description: description.trim() || null,
        isHeader,
        isActive,
      })

      if (res.success) {
        toast.success(`Account "${res.account.name}" updated successfully!`)
        const updatedAcc: AccountItem = {
          id: res.account.id,
          code: res.account.code,
          name: res.account.name,
          type: res.account.type as AccountItem['type'],
          normalBalance: res.account.normalBalance as 'debit' | 'credit',
          parentId: res.account.parentId,
          currency: res.account.currency,
          description: res.account.description,
          isHeader: res.account.isHeader,
          isSystem: res.account.isSystem,
          isActive: res.account.isActive,
          sortOrder: res.account.sortOrder,
        }
        setAccounts((prev) =>
          prev
            .map((a) => (a.id === editingAccountId ? updatedAcc : a))
            .sort((a, b) => a.code.localeCompare(b.code))
        )
        setIsEditOpen(false)
      } else {
        toast.error(res.error || 'Failed to update account')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const localizedName = getLocalizedAccountName(acc, locale)
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        localizedName.toLowerCase().includes(q) ||
        (acc.description && acc.description.toLowerCase().includes(q))

      const matchesType = selectedTypeFilter === 'all' || acc.type === selectedTypeFilter

      return matchesSearch && matchesType
    })
  }, [accounts, searchQuery, selectedTypeFilter, locale])

  // Potential Parent Accounts for currently selected type
  const t = {
    title: isAr ? 'دليل الحسابات' : isTr ? 'Hesap Planı' : 'Chart of Accounts',
    subtitle: isAr
      ? 'شجرة الحسابات المحاسبية المعيارية وحسابات الأستاذ العام'
      : isTr
      ? 'Standart Genel Muhasebe hesap yapısı'
      : 'Standardized double-entry General Ledger account structure',
    back: isAr ? 'العودة للمحاسبة' : isTr ? 'Muhasebeye Dön' : 'Back to Accounting Hub',
    exportExcel: isAr ? 'تصدير إكسل' : isTr ? 'Excel İndir' : 'Export Excel',
    importExcel: isAr ? 'استيراد إكسل' : isTr ? 'Excel Yükle' : 'Import Excel',
    newAccount: isAr ? 'حساب جديد' : isTr ? 'Yeni Hesap' : 'New Account',
    searchPlaceholder: isAr ? 'بحث برقم أو اسم الحساب...' : isTr ? 'Kod veya hesap adı ile ara...' : 'Search by code or account name...',
    allTypes: (count: number) => (isAr ? `كافة الأنواع (${count})` : isTr ? `Tüm Türler (${count})` : `All Types (${count})`),
    types: {
      asset: isAr ? 'الأصول' : isTr ? 'Varlıklar' : 'Assets',
      liability: isAr ? 'الخصوم والالتزامات' : isTr ? 'Yükümlülükler' : 'Liabilities',
      equity: isAr ? 'حقوق الملكية' : isTr ? 'Özkaynaklar' : 'Equity',
      revenue: isAr ? 'الإيرادات' : isTr ? 'Gelirler' : 'Revenue',
      expense: isAr ? 'المصروفات' : isTr ? 'Giderler' : 'Expenses',
    },
    colCode: isAr ? 'الرمز' : isTr ? 'Kod' : 'Code',
    colName: isAr ? 'اسم الحساب والتفاصيل' : isTr ? 'Hesap Adı ve Detaylar' : 'Account Name & Details',
    colBalance: isAr ? 'طبيعة الرصيد' : isTr ? 'Normal Bakiye' : 'Normal Balance',
    colCurrency: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    colActions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    active: isAr ? 'نشط' : isTr ? 'Aktif' : 'Active',
    inactive: isAr ? 'معطل' : isTr ? 'Pasif' : 'Inactive',
    headerBadge: isAr ? 'رئيسي' : isTr ? 'Ana Hesap' : 'Header',
    systemBadge: isAr ? 'نظامي' : isTr ? 'Sistem' : 'System',
    editBtn: isAr ? 'تعديل' : isTr ? 'Düzenle' : 'Edit',
    deleteBtn: isAr ? 'حذف' : isTr ? 'Sil' : 'Delete',
    ledgerBtn: isAr ? 'كشف الحساب ←' : isTr ? 'Muavin →' : 'Ledger →',
    noAccountsInCat: isAr ? 'لا توجد حسابات مطابقة ضمن هذا القسم.' : isTr ? 'Bu kategoride eşleşen hesap bulunamadı.' : 'No accounts found matching criteria.',
    addTitle: isAr ? 'إضافة حساب جديد' : isTr ? 'Yeni Hesap Ekle' : 'Add New Account',
    addSub: isAr ? 'إضافة حساب مالي جديد إلى شجرة الحسابات' : isTr ? 'Hesap planına yeni bir hesap ekleyin' : 'Create a new ledger account in your Chart of Accounts',
    editTitle: isAr ? 'تعديل بيانات الحساب' : isTr ? 'Hesabı Düzenle' : 'Edit Account',
    editSub: (c: string, n: string) => (isAr ? `تعديل الحساب ${c} - ${n}` : isTr ? `${c} - ${n} hesabını düzenleyin` : `Update ledger details for ${c} - ${n}`),
    codeLabel: isAr ? 'رمز الحساب' : isTr ? 'Hesap Kodu' : 'Account Code',
    nameLabel: isAr ? 'اسم الحساب' : isTr ? 'Hesap Adı' : 'Account Name',
    typeLabel: isAr ? 'نوع الحساب' : isTr ? 'Hesap Türü' : 'Account Type',
    normalBalanceLabel: isAr ? 'طبيعة الرصيد' : isTr ? 'Normal Bakiye' : 'Normal Balance',
    debitOption: isAr ? 'مدين (Debit)' : isTr ? 'Borç (Debit)' : 'Debit',
    creditOption: isAr ? 'دائن (Credit)' : isTr ? 'Alacak (Credit)' : 'Credit',
    parentLabel: isAr ? 'الحساب الأب (الرئيسي)' : isTr ? 'Üst Hesap (Ana)' : 'Parent Header Account',
    noParentOption: isAr ? '-- بدون حساب أب (المستوى الأول) --' : isTr ? '-- Üst hesap yok (1. Düzey) --' : '-- No parent (Top-level) --',
    currencyLabel: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    descLabel: isAr ? 'الوصف / الغرض' : isTr ? 'Açıklama / Amaç' : 'Description / Purpose',
    headerCheck: isAr ? 'حساب رئيسي (تجميعي)' : isTr ? 'Ana / Başlık Hesap' : 'Header / Parent Account',
    activeCheck: isAr ? 'حساب نشط' : isTr ? 'Aktif Hesap' : 'Active Account',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    create: isAr ? 'إنشاء الحساب' : isTr ? 'Hesap Oluştur' : 'Create Account',
    creating: isAr ? 'جاري الإنشاء...' : isTr ? 'Oluşturuluyor...' : 'Creating...',
    save: isAr ? 'حفظ التعديلات' : isTr ? 'Kaydet' : 'Save Changes',
    saving: isAr ? 'جاري الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
  }

  const potentialParents = useMemo(() => {
    return accounts.filter((a) => a.type === type && (!editingAccountId || a.id !== editingAccountId))
  }, [accounts, type, editingAccountId])

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/b/${businessId}/accounting`}
            className="btn-back"
            title={t.back}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export to Excel */}
          <a
            href={`/api/b/${businessId}/accounting/chart-of-accounts/export-excel`}
            download
            className="btn btn-secondary"
            title={t.exportExcel}
            id="export-excel-btn"
          >
            <Download size={15} />
            <span>{t.exportExcel}</span>
          </a>

          {/* Import from Excel / Template */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsExcelModalOpen(true)}
            id="import-excel-btn"
            title={t.importExcel}
          >
            <FileSpreadsheet size={15} />
            <span>{t.importExcel}</span>
          </button>

          {/* Sync / Re-initialize Standard COA */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsSyncModalOpen(true)}
            id="sync-standard-coa-btn"
            title={isAr ? 'إعادة تهيئة وتحديث الدليل القياسي المعتمد' : isTr ? 'Standart Hesap Planını Güncelle' : 'Smart Sync Standard COA'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: 'var(--color-brand-600, #4f46e5)',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isAr ? 'تهيئة وتحديث الشجرة القياسية' : isTr ? 'Standart Planı Güncelle' : 'Sync Standard COA'}</span>
          </button>

          {/* Create Account */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenAdd()}
            id="create-account-btn"
          >
            <Plus size={16} />
            <span>{t.newAccount}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          padding: '0.875rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 280px', maxWidth: '400px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        {/* Type Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${selectedTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedTypeFilter('all')}
          >
            {t.allTypes(accounts.length)}
          </button>
          {ACCOUNT_TYPES.map((typeObj) => {
            const count = accounts.filter((a) => a.type === typeObj.key).length
            const translatedLabel = t.types[typeObj.key as keyof typeof t.types] || typeObj.label
            return (
              <button
                key={typeObj.key}
                type="button"
                className={`btn btn-sm ${selectedTypeFilter === typeObj.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTypeFilter(typeObj.key)}
              >
                {translatedLabel} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Account Categories Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {ACCOUNT_TYPES.map(({ key: catType, label: catLabel }) => {
          if (selectedTypeFilter !== 'all' && selectedTypeFilter !== catType) return null

          const catAccounts = filteredAccounts.filter((a) => a.type === catType)
          if (catAccounts.length === 0 && searchQuery) return null
          const translatedCatLabel = t.types[catType as keyof typeof t.types] || catLabel

          return (
            <div key={catType} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                className="card-header"
                style={{
                  padding: '0.875rem 1.25rem',
                  background: 'var(--bg-page)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span className="card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.875rem' }}>
                    {translatedCatLabel}
                  </span>
                  <span className="badge badge-secondary">{isAr ? `${catAccounts.length} حسابات` : isTr ? `${catAccounts.length} hesap` : `${catAccounts.length} accounts`}</span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAdd(catType)}
                  style={{ height: 28, fontSize: '0.75rem', padding: '0 0.5rem' }}
                >
                  <Plus size={13} />
                  {isAr ? `إضافة إلى ${translatedCatLabel}` : isTr ? `${translatedCatLabel} Ekle` : `Add ${catLabel.slice(0, -1)}`}
                </button>
              </div>

              {catAccounts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {t.noAccountsInCat}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: '#ffffff' }}>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '12%' }}>{t.colCode}</th>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '38%' }}>{t.colName}</th>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '14%' }}>{t.colBalance}</th>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '12%' }}>{t.colCurrency}</th>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '10%' }}>{t.colStatus}</th>
                        <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '14%', textAlign: 'right' }}>{t.colActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catAccounts.map((acc) => (
                        <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>
                            {acc.code}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: acc.isHeader ? 700 : 500, color: '#0f172a' }}>
                                {getLocalizedAccountName(acc, locale)}
                              </span>
                              {acc.isHeader && (
                                <span className="badge badge-primary" style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem' }}>
                                  {t.headerBadge}
                                </span>
                              )}
                              {acc.isSystem && (
                                <span className="badge badge-secondary" style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem' }}>
                                  {t.systemBadge}
                                </span>
                              )}
                            </div>
                            {(getLocalizedAccountDescription(acc, locale) || acc.description) && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {getLocalizedAccountDescription(acc, locale) || acc.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                            <span className={`badge badge-${acc.normalBalance === 'debit' ? 'primary' : 'warning'}`}>
                              {acc.normalBalance === 'debit' ? (isAr ? 'مدين' : isTr ? 'BORÇ' : 'DEBIT') : (isAr ? 'دائن' : isTr ? 'ALACAK' : 'CREDIT')}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {acc.currency || defaultCurrency}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge badge-${acc.isActive ? 'success' : 'secondary'}`}>
                              {acc.isActive ? t.active : t.inactive}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEdit(acc)}
                                style={{ height: 30, padding: '0 0.5rem' }}
                                title={t.editBtn}
                              >
                                <Edit2 size={13} />
                                {t.editBtn}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenDelete(acc)}
                                style={{
                                  height: 30,
                                  padding: '0 0.5rem',
                                  color: '#dc2626',
                                  borderColor: 'rgba(239, 68, 68, 0.35)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                                  fontWeight: 600,
                                }}
                                title={t.deleteBtn}
                              >
                                <Trash2 size={13} />
                                {t.deleteBtn}
                              </button>
                              <Link
                                href={`/b/${businessId}/accounting/general-ledger?accountId=${acc.id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ height: 30, fontSize: '0.75rem', padding: '0 0.5rem' }}
                              >
                                {t.ledgerBtn}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CREATE ACCOUNT MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={t.addTitle}
        subtitle={t.addSub}
      >
        <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">{t.codeLabel}</label>
              <input
                type="text"
                className="form-control"
                placeholder={isAr ? 'مثال: 1010' : 'e.g. 1010'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label required">{t.nameLabel}</label>
              <input
                type="text"
                className="form-control"
                placeholder={isAr ? 'مثال: الصندوق الرئيسي' : isTr ? 'Örn: Ana Kasa' : 'e.g. Main Cash Account'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">{t.typeLabel}</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as AccountItem['type'])}
                required
              >
                {ACCOUNT_TYPES.map((typeObj) => (
                  <option key={typeObj.key} value={typeObj.key}>
                    {t.types[typeObj.key as keyof typeof t.types] || typeObj.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label required">{t.normalBalanceLabel}</label>
              <select
                className="form-control"
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value as 'debit' | 'credit')}
                required
              >
                <option value="debit">{t.debitOption}</option>
                <option value="credit">{t.creditOption}</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.parentLabel}</label>
              <AccountSearchSelect
                accounts={potentialParents}
                value={parentId}
                onChange={(val) => setParentId(val)}
                placeholder={t.noParentOption}
              />
            </div>

            <div>
              <label className="form-label">{t.currencyLabel}</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. USD, EUR, SAR"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div>
            <label className="form-label">{t.descLabel}</label>
            <textarea
              className="form-control"
              placeholder={isAr ? 'ملاحظات أو توضيحات إضافية حول هذا الحساب...' : isTr ? 'Hesap hakkında isteğe bağlı notlar...' : 'Optional notes or instructions for this ledger account...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
            <label className="form-check-card">
              <input
                type="checkbox"
                checked={isHeader}
                onChange={(e) => setIsHeader(e.target.checked)}
              />
              <span>{t.headerCheck}</span>
            </label>

            <label className="form-check-card">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>{t.activeCheck}</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddOpen(false)}
              disabled={submitting}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? t.creating : t.create}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT ACCOUNT MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t.editTitle}
        subtitle={t.editSub(code, name)}
      >
        <form onSubmit={handleUpdateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">{t.codeLabel}</label>
              <input
                type="text"
                className="form-control"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label required">{t.nameLabel}</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">{t.typeLabel}</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as AccountItem['type'])}
                required
              >
                {ACCOUNT_TYPES.map((typeObj) => (
                  <option key={typeObj.key} value={typeObj.key}>
                    {t.types[typeObj.key as keyof typeof t.types] || typeObj.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label required">{t.normalBalanceLabel}</label>
              <select
                className="form-control"
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value as 'debit' | 'credit')}
                required
              >
                <option value="debit">{t.debitOption}</option>
                <option value="credit">{t.creditOption}</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.parentLabel}</label>
              <AccountSearchSelect
                accounts={potentialParents}
                value={parentId}
                onChange={(val) => setParentId(val)}
                placeholder={t.noParentOption}
              />
            </div>

            <div>
              <label className="form-label">{t.currencyLabel}</label>
              <input
                type="text"
                className="form-control"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div>
            <label className="form-label">{t.descLabel}</label>
            <textarea
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
            <label className="form-check-card">
              <input
                type="checkbox"
                checked={isHeader}
                onChange={(e) => setIsHeader(e.target.checked)}
              />
              <span>{t.headerCheck}</span>
            </label>

            <label className="form-check-card">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>{t.activeCheck}</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div>
              {editingAccountId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    color: '#dc2626',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                  onClick={() => {
                    const acc = accounts.find((a) => a.id === editingAccountId)
                    if (acc) {
                      setIsEditOpen(false)
                      handleOpenDelete(acc)
                    }
                  }}
                  disabled={submitting}
                >
                  <Trash2 size={15} />
                  <span>{t.deleteBtn}</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditOpen(false)}
                disabled={submitting}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? t.saving : t.save}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Excel Import & Template Modal */}
      <ChartOfAccountsExcelModal
        businessId={businessId}
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={() => {
          router.refresh()
        }}
      />

      {/* DELETE / DEACTIVATE VERIFICATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting && !isTogglingStatus) {
            setIsDeleteModalOpen(false)
            setAccountToDelete(null)
          }
        }}
        title={isAr ? 'التحقق من حذف الحساب' : isTr ? 'Hesap Silme Doğrulaması' : 'Delete Account Verification'}
        maxWidth="600px"
      >
        {accountToDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Account Summary Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)' }}>
                    {accountToDelete.code}
                  </span>
                  <strong style={{ fontSize: '1rem' }}>{accountToDelete.name}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {isAr
                    ? `النوع: ${t.types[accountToDelete.type as keyof typeof t.types] || accountToDelete.type} • الرصيد: ${accountToDelete.normalBalance === 'debit' ? 'مدين' : 'دائن'}`
                    : isTr
                    ? `Tür: ${t.types[accountToDelete.type as keyof typeof t.types] || accountToDelete.type} • Bakiye: ${accountToDelete.normalBalance}`
                    : `Type: ${accountToDelete.type} • Balance: ${accountToDelete.normalBalance}`}
                </div>
              </div>

              <span className={`badge badge-${accountToDelete.isActive ? 'success' : 'secondary'}`}>
                {accountToDelete.isActive ? t.active : t.inactive}
              </span>
            </div>

            {/* State 1: Checking */}
            {checkingDeletability && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-color)', margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {isAr
                    ? 'جاري فحص القيود المحاسبية والحركات المرتبطة بالحساب...'
                    : isTr
                    ? 'Yevmiye hareketleri ve hesap bağlantıları denetleniyor...'
                    : 'Checking journal entries and associated account links...'}
                </p>
              </div>
            )}

            {/* State 2: Cannot Delete */}
            {!checkingDeletability && deletabilityInfo && !deletabilityInfo.canDelete && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--border-radius)',
                    padding: '1.25rem',
                    color: '#ef4444',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <ShieldAlert size={20} />
                    <strong style={{ fontSize: '0.95rem' }}>
                      {isAr ? 'لا يمكن حذف هذا الحساب (محمي)' : isTr ? 'Bu Hesap Silinemez (Kısıtlı)' : 'Cannot Delete Account (Restricted)'}
                    </strong>
                  </div>

                  <ul style={{ margin: '0.5rem 0', paddingRight: '1.25rem', paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    {deletabilityInfo.blockingReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>

                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-primary)', opacity: 0.85 }}>
                    💡 <strong>{isAr ? 'الحل الموصى به:' : isTr ? 'Önerilen Çözüm:' : 'Recommended Action:'}</strong>{' '}
                    {isAr
                      ? 'لضمان سلامة القيود التاريخية والتوازن المالي، يمكنك تعطيل الحساب لمنع استخدامه في المعاملات الجديدة.'
                      : isTr
                      ? 'Geçmiş kayıtların bütünlüğünü korumak için hesabı devre dışı bırakabilirsiniz.'
                      : 'To preserve historical integrity, you can deactivate the account instead of deleting it.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={isTogglingStatus}
                  >
                    {isAr ? 'إغلاق' : isTr ? 'Kapat' : 'Close'}
                  </button>
                  <button
                    type="button"
                    className={`btn ${accountToDelete.isActive ? 'btn-warning' : 'btn-primary'}`}
                    onClick={handleToggleStatus}
                    disabled={isTogglingStatus}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Power size={15} />
                    {isTogglingStatus
                      ? (isAr ? 'جاري التعديل...' : isTr ? 'İşleniyor...' : 'Updating...')
                      : accountToDelete.isActive
                      ? (isAr ? 'تعطيل الحساب' : isTr ? 'Hesabı Devre Dışı Bırak' : 'Deactivate Account')
                      : (isAr ? 'إعادة تفعيل الحساب' : isTr ? 'Hesabı Etkinleştir' : 'Activate Account')}
                  </button>
                </div>
              </div>
            )}

            {/* State 3: Safe to Delete */}
            {!checkingDeletability && deletabilityInfo && deletabilityInfo.canDelete && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 'var(--border-radius)',
                    padding: '1rem',
                    color: '#10b981',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={20} />
                    <strong style={{ fontSize: '0.95rem' }}>
                      {isAr ? 'الحساب خالٍ وقابل للحذف بأمان' : isTr ? 'Hesap Güvenle Silinebilir' : 'Safe to Delete'}
                    </strong>
                  </div>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                    {isAr
                      ? 'تم التحقق من عدم وجود أي قيود أو حركات محاسبية أو حسابات تابعة. هل أنت متأكد من رغبتك في حذفه نهائياً؟'
                      : isTr
                      ? 'Bu hesaba bağlı hiçbir hareket veya alt hesap bulunmamaktadır. Tamamen silmek istediğinizden emin misiniz?'
                      : 'No transactions or child accounts found. Are you sure you want to permanently delete this account?'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={isDeleting}
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#ef4444', color: '#ffffff' }}
                  >
                    <Trash2 size={15} />
                    {isDeleting ? (isAr ? 'جاري الحذف...' : isTr ? 'Siliniyor...' : 'Deleting...') : (isAr ? 'تأكيد الحذف نهائياً' : isTr ? 'Kalıcı Olarak Sil' : 'Delete Permanently')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Smart Sync & Re-initialize Standard COA Modal */}
      <Modal
        isOpen={isSyncModalOpen}
        onClose={() => !isSyncing && setIsSyncModalOpen(false)}
        title={isAr ? 'تهيئة وتحديث شجرة الحسابات القياسية' : isTr ? 'Standart Hesap Planını Güncelle' : 'Sync Standard Chart of Accounts'}
        subtitle={
          isAr
            ? 'مزامنة الشجرة مع أحدث معايير النظام المحاسبي وربط الحسابات تلقائياً'
            : 'Synchronize chart of accounts with latest accounting standards and linkages'
        }
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Information Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary, #0f172a)' }}>
                  {isAr ? 'المزامنة والتحديث الذكي الآمن (Smart Safe Sync)' : 'Smart Safe Sync & Repair'}
                </strong>
                <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--text-secondary, #64748b)' }}>
                  {isAr ? 'عملية فورية تضمن اكتمال وترابط حسابات منشأتك بالكامل' : 'Instant process to complete and link all business accounts'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-primary, #1e293b)' }}>
                <CheckCircle2 size={16} className="text-emerald-500" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>{isAr ? 'تنزيل الحسابات القياسية المفقودة:' : 'Download Missing Accounts:'}</strong>{' '}
                  {isAr
                    ? 'إضافة أي حسابات نظامية جديدة (مثل الأصول، الخصوم، الضرائب، الأرباح، فروق العملة، والمصروفات).'
                    : 'Creates all missing standard accounts across assets, liabilities, tax, equity, and expenses.'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-primary, #1e293b)' }}>
                <CheckCircle2 size={16} className="text-emerald-500" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>{isAr ? 'تصحيح الهيكلية والتبويب الهرمي:' : 'Repair Hierarchy:'}</strong>{' '}
                  {isAr
                    ? 'إعادة ضبط علاقات الحسابات الرئيسية والفرعية (Parent-Child) وترتيب ظهورها.'
                    : 'Re-aligns parent-child accounts hierarchy and tree sort orders.'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-primary, #1e293b)' }}>
                <CheckCircle2 size={16} className="text-emerald-500" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>{isAr ? 'إعادة ربط الخزائن والبنوك تلقائياً:' : 'Link Cash & Bank GLs:'}</strong>{' '}
                  {isAr
                    ? 'ربط حسابات الصناديق والبنوك بالدليل المحاسبي لضمان الترحيل السليم لسندات القبض والصرف.'
                    : 'Auto-links cash drawers and bank ledgers for seamless payment vouchers.'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-primary, #1e293b)' }}>
                <ShieldCheck size={16} className="text-indigo-500" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>{isAr ? 'أمان تام 100%:' : '100% Safe:'}</strong>{' '}
                  {isAr
                    ? 'لن يتم حذف أي حساب مخصص أنشأته أنت، ولن تتأثر أي قيود أو فواتير أو حركات سابقة إطلاقاً.'
                    : 'Your custom accounts and historical transactions are 100% preserved without any deletion.'}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSyncModalOpen(false)}
              disabled={isSyncing}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSyncStandardCOA}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              }}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              <span>
                {isSyncing
                  ? isAr
                    ? 'جاري المزامنة والتحديث...'
                    : 'Synchronizing...'
                  : isAr
                  ? 'تأكيد التهيئة والتحديث الآن'
                  : 'Confirm & Sync Now'}
              </span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
