'use client'

import React from 'react'
import Link from 'next/link'
import { DollarSign, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'

export interface PaymentRow {
  id: string
  paymentNumber: string
  type: string
  method: string
  partyName: string
  accountName: string
  paymentDate: string | Date
  amount: number
  allocatedAmount: number
  unallocatedAmount: number
  status: string
  currencyCode: string
}

interface PaymentsListClientProps {
  businessId: string
  payments: PaymentRow[]
}

export function PaymentsListClient({ businessId, payments }: PaymentsListClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const t = {
    title: isAr ? 'المدفوعات والمقبوضات' : isTr ? 'Ödemeler ve Tahsilatlar' : 'Payments & Receipts',
    subtitle: isAr
      ? 'إدارة سندات القبض للعملاء وسندات الصرف للموردين وتتبع التدفقات النقدية'
      : isTr
      ? 'Müşteri tahsilatlarını ve tedarikçi ödemelerini izleyin'
      : 'Track incoming customer receipts and outgoing vendor disbursements',
    receivePayment: isAr ? 'سند قبض عميل' : isTr ? 'Tahsilat Al' : 'Receive Payment',
    makePayment: isAr ? 'سند صرف مورد' : isTr ? 'Ödeme Yap' : 'Make Payment',
    paymentNumber: isAr ? 'رقم السند' : isTr ? 'İşlem No' : 'Payment #',
    type: isAr ? 'نوع السند' : isTr ? 'Tür' : 'Type',
    partyName: isAr ? 'الطرف (عميل / مورد)' : isTr ? 'Müşteri / Tedarikçi' : 'Customer / Supplier',
    accountName: isAr ? 'الحساب / طريقة الدفع' : isTr ? 'Ödeme Hesabı' : 'Payment Account',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    amount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    searchPlaceholder: isAr ? 'بحث برقم السند أو اسم الطرف أو الحساب...' : isTr ? 'İşlem no, müşteri veya hesap ara...' : 'Search payment #, customer or supplier...',
    emptyTitle: isAr ? 'لا توجد سندات مسجلة' : isTr ? 'Kayıtlı Ödeme/Tahsilat Yok' : 'No Payments Recorded',
    emptySubtext: isAr
      ? 'ابدأ بتسجيل أول سند قبض من عميل أو سند صرف لمورد لإدارة التدفق النقدي.'
      : isTr
      ? 'Nakit akışını yönetmek için ilk tahsilatınızı veya ödemenizi kaydedin.'
      : 'Record your first customer receipt or vendor payment to manage cash flows.',
    types: {
      incoming: isAr ? 'قبض (وارد)' : isTr ? 'Tahsilat (Giriş)' : 'Incoming',
      outgoing: isAr ? 'صرف (صادر)' : isTr ? 'Ödeme (Çıkış)' : 'Outgoing',
    },
    statuses: {
      completed: isAr ? 'مكتمل' : isTr ? 'Tamamlandı' : 'Completed',
      allocated: isAr ? 'مسند بالكامل' : isTr ? 'Eşleştirildi' : 'Allocated',
      partial: isAr ? 'مسند جزئياً' : isTr ? 'Kısmi' : 'Partial',
      voided: isAr ? 'ملغى' : isTr ? 'İptal' : 'Voided',
    },
  }

  const columns: Column<PaymentRow>[] = [
    {
      key: 'paymentNumber',
      header: t.paymentNumber,
      sortable: true,
      sortValue: (r) => r.paymentNumber,
      accessor: (r) => <span style={{ fontWeight: 600 }}>{r.paymentNumber}</span>,
    },
    {
      key: 'type',
      header: t.type,
      sortable: true,
      sortValue: (r) => r.type,
      accessor: (r) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: r.type === 'incoming' ? 'var(--color-success)' : 'var(--color-danger)',
            fontWeight: 600,
          }}
        >
          {r.type === 'incoming' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
          {t.types[r.type as keyof typeof t.types] || r.type}
        </span>
      ),
    },
    {
      key: 'partyName',
      header: t.partyName,
      sortable: true,
      sortValue: (r) => r.partyName,
      accessor: (r) => r.partyName,
    },
    {
      key: 'accountName',
      header: t.accountName,
      sortable: true,
      sortValue: (r) => r.accountName,
      accessor: (r) => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {r.accountName} ({r.method.replace('_', ' ')})
        </span>
      ),
    },
    {
      key: 'paymentDate',
      header: t.date,
      sortable: true,
      sortValue: (r) => new Date(r.paymentDate).getTime(),
      accessor: (r) => formatDate(r.paymentDate),
    },
    {
      key: 'amount',
      header: t.amount,
      sortable: true,
      sortValue: (r) => r.amount,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: r.type === 'incoming' ? 'var(--color-success)' : 'var(--text-primary)' }}>
          {formatCurrency(r.amount, r.currencyCode)}
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
        if (r.status === 'completed' || r.status === 'allocated') badgeClass = 'badge-success'
        if (r.status === 'partial') badgeClass = 'badge-warning'
        if (r.status === 'voided') badgeClass = 'badge-danger'

        return <span className={`badge ${badgeClass}`}>{t.statuses[r.status as keyof typeof t.statuses] || r.status}</span>
      },
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/payments/incoming/new`} className="btn btn-primary" id="receive-payment-btn">
            <Plus size={16} />
            {t.receivePayment}
          </Link>
          <Link href={`/b/${businessId}/payments/outgoing/new`} className="btn btn-secondary" id="make-payment-btn">
            <Plus size={16} />
            {t.makePayment}
          </Link>
        </div>
      </div>

      <DataTable
        data={payments}
        columns={columns}
        searchKey={(r) => `${r.paymentNumber} ${r.partyName} ${r.accountName}`}
        searchPlaceholder={t.searchPlaceholder}
        statusKey={(r) => r.status}
        statusOptions={[
          { label: t.statuses.completed, value: 'completed' },
          { label: t.statuses.allocated, value: 'allocated' },
          { label: t.statuses.partial, value: 'partial' },
          { label: t.statuses.voided, value: 'voided' },
        ]}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <Link href={`/b/${businessId}/payments/incoming/new`} className="btn btn-primary btn-sm">
            {t.receivePayment}
          </Link>
        }
      />
    </div>
  )
}
