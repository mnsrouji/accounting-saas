'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Truck, Eye, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { createSupplierAction } from '@/actions/purchases/purchase-actions'

interface SupplierRow {
  id: string
  code: string | null
  name: string
  companyName: string | null
  email: string | null
  phone: string | null
  currency: string
  balance: number
  isActive: boolean
}

interface SupplierListClientProps {
  businessId: string
  defaultCurrency: string
  suppliers: SupplierRow[]
}

export function SupplierListClient({ businessId, defaultCurrency, suppliers }: SupplierListClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)

  const t = {
    title: isAr ? 'دليل الموردين' : isTr ? 'Tedarikçiler' : 'Suppliers',
    subtitle: isAr
      ? 'إدارة بيانات الموردين، المستحقات، وكشوفات الحساب'
      : isTr
      ? 'Tedarikçi rehberini, borç bakiyelerini ve hesap ekstrelerini yönetin'
      : 'Manage supplier directory, payables & account statements',
    addSupplier: isAr ? 'إضافة مورد جديد' : isTr ? 'Yeni Tedarikçi Ekle' : 'Add Supplier',
    name: isAr ? 'اسم المورد' : isTr ? 'Tedarikçi Adı' : 'Supplier Name',
    contact: isAr ? 'معلومات الاتصال' : isTr ? 'İletişim Bilgileri' : 'Contact Info',
    currency: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    balance: isAr ? 'رصيد المورد المستحق' : isTr ? 'Ödenecek Bakiye' : 'Payable Balance',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    statement: isAr ? 'كشف حساب' : isTr ? 'Hesap Ekstresi' : 'Statement',
    searchPlaceholder: isAr
      ? 'بحث بالاسم، الشركة، أو البريد الإلكتروني...'
      : isTr
      ? 'Tedarikçi adı, şirket veya e-posta ara...'
      : 'Search suppliers by name, company, email...',
    emptyTitle: isAr ? 'لا يوجد موردين مسجلين' : isTr ? 'Kayıtlı Tedarikçi Yok' : 'No Suppliers Found',
    emptySubtext: isAr
      ? 'أضف أول مورد للبدء في تسجيل فواتير المشتريات ومتابعة المدفوعات.'
      : isTr
      ? 'Alış faturası ve gider kaydetmek için ilk tedarikçinizi ekleyin.'
      : 'Add your first supplier to start logging purchase bills.',
    createModalTitle: isAr ? 'إضافة مورد جديد' : isTr ? 'Yeni Tedarikçi Oluştur' : 'Create New Supplier',
    supplierNameLabel: isAr ? 'اسم المورد / جهة الاتصال' : isTr ? 'Tedarikçi / İlgili Kişi Adı' : 'Supplier / Contact Name',
    companyNameLabel: isAr ? 'اسم الشركة (اختياري)' : isTr ? 'Şirket Ünvanı (İsteğe bağlı)' : 'Company Name',
    emailLabel: isAr ? 'البريد الإلكتروني' : isTr ? 'E-posta Adresi' : 'Email Address',
    phoneLabel: isAr ? 'رقم الهاتف / الجوال' : isTr ? 'Telefon Numarası' : 'Phone Number',
    currencyLabel: isAr ? 'عملة التعامل' : isTr ? 'İşlem Para Birimi' : 'Preferred Currency',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    createBtn: isAr ? 'حفظ المورد' : isTr ? 'Tedarikçiyi Kaydet' : 'Create Supplier',
    creating: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Creating...',
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(isAr ? 'اسم المورد مطلوب' : isTr ? 'Tedarikçi adı zorunludur' : 'Supplier name is required')
      return
    }

    setLoading(true)
    try {
      const res = await createSupplierAction(businessId, {
        name,
        companyName: companyName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        currency,
      })

      if (res.success) {
        toast.success(isAr ? `تمت إضافة المورد "${name}" بنجاح!` : isTr ? `"${name}" tedarikçisi başarıyla eklendi!` : `Supplier ${name} created successfully!`)
        setIsModalOpen(false)
        setName('')
        setCompanyName('')
        setEmail('')
        setPhone('')
      } else {
        toast.error(res.error || (isAr ? 'فشل في إضافة المورد' : isTr ? 'Tedarikçi eklenemedi' : 'Failed to create supplier'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      header: t.name,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/suppliers/${r.id}`}
            style={{ fontWeight: 600, color: 'var(--color-brand-500)', textDecoration: 'none' }}
          >
            {r.name}
          </Link>
          {r.companyName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.companyName}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: t.contact,
      accessor: (r) => (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {r.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Mail size={12} /> {r.email}</div>}
          {r.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Phone size={12} /> {r.phone}</div>}
          {!r.email && !r.phone && '—'}
        </div>
      ),
    },
    {
      key: 'currency',
      header: t.currency,
      sortable: true,
      sortValue: (r) => r.currency,
      accessor: (r) => r.currency,
    },
    {
      key: 'balance',
      header: t.balance,
      sortable: true,
      sortValue: (r) => r.balance,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: r.balance > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
          {formatCurrency(r.balance, r.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.actions,
      hideable: false,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/suppliers/${r.id}`}
          className="btn btn-secondary btn-sm"
          style={{ height: 32, padding: '0 0.625rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Eye size={14} />
          {t.statement}
        </Link>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
          id="new-supplier-btn"
        >
          <Plus size={16} />
          {t.addSupplier}
        </button>
      </div>

      <DataTable
        data={suppliers}
        columns={columns}
        searchKey={(r) => `${r.name} ${r.companyName || ''} ${r.email || ''}`}
        searchPlaceholder={t.searchPlaceholder}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            {t.addSupplier}
          </button>
        }
      />

      {/* Add Supplier Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t.createModalTitle}>
        <form onSubmit={handleCreateSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label required">{t.supplierNameLabel}</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Supplier Co."
              required
            />
          </div>

          <div>
            <label className="form-label">{t.companyNameLabel}</label>
            <input
              type="text"
              className="form-control"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Global Logistics Ltd."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.emailLabel}</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accounts@supplier.com"
              />
            </div>
            <div>
              <label className="form-label">{t.phoneLabel}</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
              />
            </div>
          </div>

          <div>
            <label className="form-label required">{t.currencyLabel}</label>
            <select
              className="form-control"
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.creating : t.createBtn}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
