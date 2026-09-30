'use client'

import React from 'react'
import Link from 'next/link'
import { Plus, Eye } from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'

export interface SaleRow {
  id: string
  invoiceNumber: string
  customerName: string
  invoiceDate: string | Date
  dueDate: string | Date | null
  totalAmount: number
  paidAmount: number
  balanceDue: number
  status: string
  currencyCode: string
}

interface SalesListClientProps {
  businessId: string
  sales: SaleRow[]
}

export function SalesListClient({ businessId, sales }: SalesListClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const t = {
    title: isAr ? 'فواتير المبيعات' : isTr ? 'Satış Faturaları' : 'Sales & Invoices',
    subtitle: isAr
      ? 'إدارة فواتير العملاء، متابعة التحصيل، وترحيل الإيرادات تلقائياً'
      : isTr
      ? 'Müşteri faturalarını yönetin, tahsilatları ve gelir kayıtlarını izleyin'
      : 'Manage customer invoicing, tracking & revenue posting',
    newInvoice: isAr ? 'فاتورة مبيعات جديدة' : isTr ? 'Yeni Fatura' : 'New Invoice',
    invoiceNumber: isAr ? 'رقم الفاتورة' : isTr ? 'Fatura No' : 'Invoice #',
    customer: isAr ? 'العميل' : isTr ? 'Müşteri' : 'Customer',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    totalAmount: isAr ? 'إجمالي المبلغ' : isTr ? 'Genel Toplam' : 'Total Amount',
    paid: isAr ? 'المدفوع' : isTr ? 'Ödenen' : 'Paid',
    balanceDue: isAr ? 'المتبقي للتحصيل' : isTr ? 'Kalan Bakiye' : 'Balance Due',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    view: isAr ? 'عرض' : isTr ? 'Görüntüle' : 'View',
    searchPlaceholder: isAr
      ? 'بحث برقم الفاتورة أو اسم العميل...'
      : isTr
      ? 'Fatura no veya müşteri ara...'
      : 'Search invoice # or customer...',
    emptyTitle: isAr ? 'لا توجد فواتير مبيعات' : isTr ? 'Satış Faturası Bulunamadı' : 'No Sales Invoices Found',
    emptySubtext: isAr
      ? 'ابدأ بإصدار أول فاتورة مبيعات لعملائك لتوثيق الإيرادات وحسابات القبض.'
      : isTr
      ? 'Müşterileriniz için ilk satış faturasını oluşturarak başlayın.'
      : 'Get started by creating your first sales invoice for a customer.',
    createBtn: isAr ? 'إصدار فاتورة' : isTr ? 'Fatura Kes' : 'Create Invoice',
    statuses: {
      draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
      sent: isAr ? 'مرسلة' : isTr ? 'Gönderildi' : 'Sent',
      paid: isAr ? 'مدفوعة' : isTr ? 'Ödendi' : 'Paid',
      partial: isAr ? 'مدفوعة جزئياً' : isTr ? 'Kısmi Ödendi' : 'Partially Paid',
      overdue: isAr ? 'متأخرة' : isTr ? 'Vadesi Geçmiş' : 'Overdue',
      voided: isAr ? 'ملغاة' : isTr ? 'İptal Edildi' : 'Voided',
    },
  }

  const columns: Column<SaleRow>[] = [
    {
      key: 'invoiceNumber',
      header: t.invoiceNumber,
      sortable: true,
      sortValue: (r) => r.invoiceNumber,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/sales/${r.id}`}
          style={{ color: 'var(--color-brand-500)', fontWeight: 600, textDecoration: 'none' }}
        >
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'customerName',
      header: t.customer,
      sortable: true,
      sortValue: (r) => r.customerName,
      accessor: (r) => r.customerName,
    },
    {
      key: 'invoiceDate',
      header: t.date,
      sortable: true,
      sortValue: (r) => new Date(r.invoiceDate).getTime(),
      accessor: (r) => formatDate(r.invoiceDate),
    },
    {
      key: 'totalAmount',
      header: t.totalAmount,
      sortable: true,
      sortValue: (r) => r.totalAmount,
      accessor: (r) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(r.totalAmount, r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      header: t.paid,
      sortable: true,
      sortValue: (r) => r.paidAmount,
      accessor: (r) => formatCurrency(r.paidAmount, r.currencyCode),
    },
    {
      key: 'balanceDue',
      header: t.balanceDue,
      sortable: true,
      sortValue: (r) => r.balanceDue,
      accessor: (r) => (
        <span style={{ color: r.balanceDue > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: r.balanceDue > 0 ? 600 : 400 }}>
          {formatCurrency(r.balanceDue, r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.status,
      sortable: true,
      sortValue: (r) => r.status,
      accessor: (r) => {
        let badgeClass = 'badge-secondary'
        if (r.status === 'paid') badgeClass = 'badge-success'
        if (r.status === 'sent') badgeClass = 'badge-primary'
        if (r.status === 'partial') badgeClass = 'badge-warning'
        if (r.status === 'overdue' || r.status === 'voided') badgeClass = 'badge-danger'

        const label = (t.statuses as any)[r.status] || r.status
        return <span className={`badge ${badgeClass}`}>{label}</span>
      },
    },
    {
      key: 'actions',
      header: t.actions,
      hideable: false,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/sales/${r.id}`}
          className="btn btn-secondary btn-sm"
          style={{ height: 32, padding: '0 0.625rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Eye size={14} />
          {t.view}
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
        <Link href={`/b/${businessId}/sales/new`} className="btn btn-primary" id="new-sales-invoice-btn">
          <Plus size={16} />
          {t.newInvoice}
        </Link>
      </div>

      <DataTable
        data={sales}
        columns={columns}
        searchKey={(r) => `${r.invoiceNumber} ${r.customerName}`}
        searchPlaceholder={t.searchPlaceholder}
        statusKey={(r) => r.status}
        statusOptions={[
          { label: t.statuses.draft, value: 'draft' },
          { label: t.statuses.sent, value: 'sent' },
          { label: t.statuses.paid, value: 'paid' },
          { label: t.statuses.partial, value: 'partial' },
          { label: t.statuses.overdue, value: 'overdue' },
        ]}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <Link href={`/b/${businessId}/sales/new`} className="btn btn-primary btn-sm">
            {t.createBtn}
          </Link>
        }
      />
    </div>
  )
}
