'use client'

import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'

export interface ExpenseRow {
  id: string
  expenseNumber: string
  expenseDate: string | Date
  description: string
  accountName: string
  paymentSource: string
  vendor: string
  amount: number
  taxAmount: number
  status: string
  currencyCode: string
}

interface ExpensesListClientProps {
  businessId: string
  expenses: ExpenseRow[]
}

export function ExpensesListClient({ businessId, expenses }: ExpensesListClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const t = {
    title: isAr ? 'المصروفات التشغيلية' : isTr ? 'Faaliyet Giderleri' : 'Operating Expenses',
    subtitle: isAr
      ? 'تتبع النفقات التشغيلية والإيجارات والفواتير والتدفقات الخارجة'
      : isTr
      ? 'Operasyonel giderleri, kiraları, faturaları ve nakit çıkışlarını izleyin'
      : 'Track business operational overhead, rent, utilities & cash outflows',
    newExpense: isAr ? 'تسجيل مصروف جديد' : isTr ? 'Gider Kaydet' : 'Record Expense',
    expenseNumber: isAr ? 'رقم المصروف' : isTr ? 'Gider No' : 'Expense #',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    description: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    vendor: isAr ? 'المستفيد / الجهة' : isTr ? 'Tedarikçi / Alıcı' : 'Vendor',
    expenseAccount: isAr ? 'حساب المصروف' : isTr ? 'Gider Hesabı' : 'Expense Account',
    paidFrom: isAr ? 'طريقة الدفع / الصندوق' : isTr ? 'Ödeme Kaynağı' : 'Paid From',
    amount: isAr ? 'إجمالي المبلغ' : isTr ? 'Toplam Tutar' : 'Total Amount',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    searchPlaceholder: isAr ? 'بحث برقم المصروف أو البيان أو الحساب...' : isTr ? 'Gider no, açıklama veya hesap ara...' : 'Search expense #, description, account...',
    emptyTitle: isAr ? 'لا توجد مصروفات مسجلة' : isTr ? 'Kayıtlı Gider Yok' : 'No Expenses Recorded',
    emptySubtext: isAr
      ? 'قم بتسجيل نفقات العمل التشغيلية لتتبع التدفقات النقدية الخارجة بدقة.'
      : isTr
      ? 'Nakit çıkışlarını izlemek için işletme giderlerinizi kaydedin.'
      : 'Record business expenses to track operating costs against your accounts.',
    statuses: {
      posted: isAr ? 'مرحل' : isTr ? 'Kaydedildi' : 'Posted',
      draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
      voided: isAr ? 'ملغى' : isTr ? 'İptal' : 'Voided',
    },
  }

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'expenseNumber',
      header: t.expenseNumber,
      sortable: true,
      sortValue: (r) => r.expenseNumber,
      accessor: (r) => <span style={{ fontWeight: 600 }}>{r.expenseNumber}</span>,
    },
    {
      key: 'expenseDate',
      header: t.date,
      sortable: true,
      sortValue: (r) => new Date(r.expenseDate).getTime(),
      accessor: (r) => formatDate(r.expenseDate),
    },
    {
      key: 'description',
      header: t.description,
      sortable: true,
      sortValue: (r) => r.description,
      accessor: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.description}</div>
          {r.vendor && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t.vendor}: {r.vendor}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'accountName',
      header: t.expenseAccount,
      sortable: true,
      sortValue: (r) => r.accountName,
      accessor: (r) => r.accountName,
    },
    {
      key: 'paymentSource',
      header: t.paidFrom,
      accessor: (r) => r.paymentSource,
    },
    {
      key: 'amount',
      header: t.amount,
      sortable: true,
      sortValue: (r) => r.amount,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
          {formatCurrency(r.amount, r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.status,
      sortable: true,
      sortValue: (r) => r.status,
      accessor: (r) => (
        <span className="badge badge-success">
          {t.statuses[r.status as keyof typeof t.statuses] || r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <Link href={`/b/${businessId}/expenses/new`} className="btn btn-primary" id="new-expense-btn">
          <Plus size={16} />
          {t.newExpense}
        </Link>
      </div>

      <DataTable
        data={expenses}
        columns={columns}
        searchKey={(r) => `${r.expenseNumber} ${r.description} ${r.vendor} ${r.accountName}`}
        searchPlaceholder={t.searchPlaceholder}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <Link href={`/b/${businessId}/expenses/new`} className="btn btn-primary btn-sm">
            {t.newExpense}
          </Link>
        }
      />
    </div>
  )
}
