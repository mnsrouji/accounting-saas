'use client'

import React from 'react'
import Link from 'next/link'
import { Plus, Eye } from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'

export interface PurchaseRow {
  id: string
  purchaseNumber: string
  supplierName: string
  purchaseDate: string | Date
  dueDate: string | Date | null
  totalAmount: number
  paidAmount: number
  balanceDue: number
  status: string
  currencyCode: string
}

interface PurchasesListClientProps {
  businessId: string
  purchases: PurchaseRow[]
}

export function PurchasesListClient({ businessId, purchases }: PurchasesListClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const t = {
    title: isAr ? 'فواتير المشتريات' : isTr ? 'Alış Faturaları' : 'Purchase Invoices',
    subtitle: isAr
      ? 'متابعة فواتير الموردين، استلام المخزون، وسندات الصرف'
      : isTr
      ? 'Tedarikçi faturalarını, stok girişlerini ve ödemeleri izleyin'
      : 'Track supplier bills, expenses & inventory receipts',
    newBill: isAr ? 'فاتورة شراء جديدة' : isTr ? 'Yeni Alış Faturası' : 'New Bill',
    purchaseNumber: isAr ? 'رقم الفاتورة' : isTr ? 'Fatura / İrsaliye No' : 'Purchase #',
    supplier: isAr ? 'المورد' : isTr ? 'Tedarikçi' : 'Supplier',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    totalAmount: isAr ? 'إجمالي المبلغ' : isTr ? 'Genel Toplam' : 'Total Amount',
    paid: isAr ? 'المدفوع' : isTr ? 'Ödenen' : 'Paid',
    balanceDue: isAr ? 'المتبقي للمورد' : isTr ? 'Kalan Borç' : 'Balance Due',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    view: isAr ? 'عرض' : isTr ? 'Görüntüle' : 'View',
    searchPlaceholder: isAr
      ? 'بحث برقم الفاتورة أو اسم المورد...'
      : isTr
      ? 'Fatura no veya tedarikçi ara...'
      : 'Search bill # or supplier...',
    emptyTitle: isAr ? 'لا توجد فواتير مشتريات' : isTr ? 'Alış Faturası Bulunamadı' : 'No Purchase Bills Found',
    emptySubtext: isAr
      ? 'ابدأ بتسجيل أول فاتورة شراء من المورد لإثبات التكاليف وحسابات الموردين.'
      : isTr
      ? 'Tedarikçinizden aldığınız ilk alış faturasını kaydederek başlayın.'
      : 'Get started by logging your first supplier purchase or procurement bill.',
    createBtn: isAr ? 'تسجيل فاتورة شراء' : isTr ? 'Fatura Kaydet' : 'Record Bill',
    statuses: {
      draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
      ordered: isAr ? 'تم الطلب' : isTr ? 'Sipariş Edildi' : 'Ordered',
      received: isAr ? 'مستلمة' : isTr ? 'Teslim Alındı' : 'Received',
      paid: isAr ? 'مدفوعة' : isTr ? 'Ödendi' : 'Paid',
      partial: isAr ? 'مدفوعة جزئياً' : isTr ? 'Kısmi Ödendi' : 'Partially Paid',
      overdue: isAr ? 'متأخرة' : isTr ? 'Vadesi Geçmiş' : 'Overdue',
      voided: isAr ? 'ملغاة' : isTr ? 'İptal Edildi' : 'Voided',
    },
  }

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'purchaseNumber',
      header: t.purchaseNumber,
      sortable: true,
      sortValue: (r) => r.purchaseNumber,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/purchases/${r.id}`}
          style={{ color: 'var(--color-brand-500)', fontWeight: 600, textDecoration: 'none' }}
        >
          {r.purchaseNumber}
        </Link>
      ),
    },
    {
      key: 'supplierName',
      header: t.supplier,
      sortable: true,
      sortValue: (r) => r.supplierName,
      accessor: (r) => r.supplierName,
    },
    {
      key: 'purchaseDate',
      header: t.date,
      sortable: true,
      sortValue: (r) => new Date(r.purchaseDate).getTime(),
      accessor: (r) => formatDate(r.purchaseDate),
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
        if (r.status === 'received' || r.status === 'ordered') badgeClass = 'badge-primary'
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
          href={`/b/${businessId}/purchases/${r.id}`}
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
        <Link href={`/b/${businessId}/purchases/new`} className="btn btn-primary" id="new-purchase-invoice-btn">
          <Plus size={16} />
          {t.newBill}
        </Link>
      </div>

      <DataTable
        data={purchases}
        columns={columns}
        searchKey={(r) => `${r.purchaseNumber} ${r.supplierName}`}
        searchPlaceholder={t.searchPlaceholder}
        statusKey={(r) => r.status}
        statusOptions={[
          { label: t.statuses.draft, value: 'draft' },
          { label: t.statuses.ordered, value: 'ordered' },
          { label: t.statuses.received, value: 'received' },
          { label: t.statuses.paid, value: 'paid' },
          { label: t.statuses.partial, value: 'partial' },
          { label: t.statuses.overdue, value: 'overdue' },
        ]}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <Link href={`/b/${businessId}/purchases/new`} className="btn btn-primary btn-sm">
            {t.createBtn}
          </Link>
        }
      />
    </div>
  )
}
