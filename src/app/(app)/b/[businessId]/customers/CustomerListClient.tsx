'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Eye, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { createCustomerAction } from '@/actions/sales/sales-actions'

interface CustomerRow {
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

interface CustomerListClientProps {
  businessId: string
  defaultCurrency: string
  customers: CustomerRow[]
}

export function CustomerListClient({ businessId, defaultCurrency, customers }: CustomerListClientProps) {
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
    title: isAr ? 'دليل العملاء' : isTr ? 'Müşteriler' : 'Customers',
    subtitle: isAr
      ? 'إدارة بيانات العملاء، الأرصدة المستحقة، وكشوفات الحساب'
      : isTr
      ? 'Müşteri rehberini, bakiyeleri ve hesap ekstrelerini yönetin'
      : 'Manage customer directory, balances & account statements',
    addCustomer: isAr ? 'إضافة عميل جديد' : isTr ? 'Yeni Müşteri Ekle' : 'Add Customer',
    name: isAr ? 'اسم العميل' : isTr ? 'Müşteri Adı' : 'Customer Name',
    contact: isAr ? 'معلومات الاتصال' : isTr ? 'İletişim Bilgileri' : 'Contact Info',
    currency: isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency',
    balance: isAr ? 'رصيد الحساب' : isTr ? 'Hesap Bakiyesi' : 'Account Balance',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    statement: isAr ? 'كشف حساب' : isTr ? 'Hesap Ekstresi' : 'Statement',
    searchPlaceholder: isAr
      ? 'بحث بالاسم، الشركة، أو البريد الإلكتروني...'
      : isTr
      ? 'Müşteri adı, şirket veya e-posta ara...'
      : 'Search customers by name, company, email...',
    emptyTitle: isAr ? 'لا يوجد عملاء مسجلين' : isTr ? 'Kayıtlı Müşteri Yok' : 'No Customers Found',
    emptySubtext: isAr
      ? 'أضف أول عميل للبدء في إنشاء فواتير المبيعات ومتابعة المستحقات.'
      : isTr
      ? 'Satış faturası oluşturmak için ilk müşterinizi ekleyin.'
      : 'Add your first customer to start creating sales invoices.',
    createModalTitle: isAr ? 'إضافة عميل جديد' : isTr ? 'Yeni Müşteri Oluştur' : 'Create New Customer',
    clientNameLabel: isAr ? 'اسم العميل / جهة الاتصال' : isTr ? 'Müşteri / İlgili Kişi Adı' : 'Customer / Contact Name',
    companyNameLabel: isAr ? 'اسم الشركة (اختياري)' : isTr ? 'Şirket Ünvanı (İsteğe bağlı)' : 'Company Name',
    emailLabel: isAr ? 'البريد الإلكتروني' : isTr ? 'E-posta Adresi' : 'Email Address',
    phoneLabel: isAr ? 'رقم الهاتف / الجوال' : isTr ? 'Telefon Numarası' : 'Phone Number',
    currencyLabel: isAr ? 'عملة التعامل' : isTr ? 'İşlem Para Birimi' : 'Preferred Currency',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    createBtn: isAr ? 'حفظ العميل' : isTr ? 'Müşteriyi Kaydet' : 'Create Customer',
    creating: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Creating...',
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(isAr ? 'اسم العميل مطلوب' : isTr ? 'Müşteri adı zorunludur' : 'Customer name is required')
      return
    }

    setLoading(true)
    try {
      const res = await createCustomerAction(businessId, {
        name,
        companyName: companyName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        currency,
      })

      if (res.success) {
        toast.success(isAr ? `تمت إضافة العميل "${name}" بنجاح!` : isTr ? `"${name}" müşterisi başarıyla eklendi!` : `Customer ${name} created successfully!`)
        setIsModalOpen(false)
        setName('')
        setCompanyName('')
        setEmail('')
        setPhone('')
      } else {
        toast.error(res.error || (isAr ? 'فشل في إضافة العميل' : isTr ? 'Müşteri eklenemedi' : 'Failed to create customer'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: t.name,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/customers/${r.id}`}
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
          href={`/b/${businessId}/customers/${r.id}`}
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
          id="new-customer-btn"
        >
          <Plus size={16} />
          {t.addCustomer}
        </button>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        searchKey={(r) => `${r.name} ${r.companyName || ''} ${r.email || ''}`}
        searchPlaceholder={t.searchPlaceholder}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            {t.addCustomer}
          </button>
        }
      />

      {/* Add Customer Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t.createModalTitle}>
        <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label required">{t.clientNameLabel}</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp / John Doe"
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
              placeholder="e.g. Acme Global Inc."
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
                placeholder="billing@acme.com"
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
