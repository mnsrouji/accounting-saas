import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Users, Mail, Phone, ShoppingCart, DollarSign, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/decimal'

export const metadata: Metadata = {
  title: 'Customer Statement | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; customerId: string }>
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { businessId, customerId } = await params
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(customerId)) {
    notFound()
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      sales: { orderBy: { invoiceDate: 'desc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })

  if (!customer) notFound()

  // Calculate totals
  const totalInvoiced = customer.sales.reduce((acc, s) => acc.plus(s.totalAmount.toString()), new (require('decimal.js'))(0))
  const totalPaid = customer.payments.reduce((acc, p) => acc.plus(p.amount.toString()), new (require('decimal.js'))(0))

  const t = {
    back: isAr ? 'الرجوع للعملاء' : isTr ? 'Müşterilere Dön' : 'Back to Customers',
    subtitle: isAr ? 'كشف وحساب العميل' : isTr ? 'Müşteri Hesabı ve Ekstresi' : 'Customer Account & Statement',
    newInvoice: isAr ? 'فاتورة جديدة' : isTr ? 'Yeni Fatura' : 'New Invoice',
    receivePayment: isAr ? 'سند قبض' : isTr ? 'Tahsilat Al' : 'Receive Payment',
    infoTitle: isAr ? 'بيانات العميل' : isTr ? 'Müşteri Bilgileri' : 'Customer Information',
    accountCode: isAr ? 'كود الحساب' : isTr ? 'Hesap Kodu' : 'Account Code',
    company: isAr ? 'الشركة / المؤسسة' : isTr ? 'Şirket' : 'Company',
    currency: isAr ? 'العملة المفضلة' : isTr ? 'Para Birimi' : 'Preferred Currency',
    totalInvoiced: isAr ? 'إجمالي المبيعات المفوترة' : isTr ? 'Toplam Faturalanan' : 'Total Invoiced',
    totalPaid: isAr ? 'إجمالي المقبوضات' : isTr ? 'Toplam Tahsilat' : 'Total Payments Received',
    currentBalance: isAr ? 'الرصيد المستحق الحالي' : isTr ? 'Güncel Bakiye' : 'Current Account Balance',
    invoiceHistory: isAr ? 'سجل فواتير المبيعات' : isTr ? 'Satış Faturaları Geçmişi' : 'Sales Invoice History',
    invoiceNum: isAr ? 'رقم الفاتورة' : isTr ? 'Fatura No' : 'Invoice #',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    total: isAr ? 'الإجمالي' : isTr ? 'Toplam' : 'Total',
    balanceDue: isAr ? 'المتبقي' : isTr ? 'Kalan Tutar' : 'Balance Due',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    noInvoices: isAr ? 'لا توجد فواتير مسجلة لهذا العميل حتى الآن.' : isTr ? 'Bu müşteri için henüz fatura kaydedilmedi.' : 'No invoices recorded for this customer.',
    statuses: {
      paid: isAr ? 'مسددة' : isTr ? 'Ödendi' : 'Paid',
      partial: isAr ? 'مسددة جزئياً' : isTr ? 'Kısmi' : 'Partial',
      posted: isAr ? 'مرحلة' : isTr ? 'İşlendi' : 'Posted',
    } as Record<string, string>,
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/customers`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t.back}>
            <ArrowLeft size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <h1 className="page-title">{customer.name}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/sales/new`} className="btn btn-primary btn-sm">
            {t.newInvoice}
          </Link>
          <Link href={`/b/${businessId}/payments/incoming/new`} className="btn btn-secondary btn-sm">
            {t.receivePayment}
          </Link>
        </div>
      </div>

      {/* Profile & KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.infoTitle}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.accountCode}</div>
              <div style={{ fontWeight: 600 }}>{customer.code}</div>
            </div>
            {customer.companyName && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.company}</div>
                <div>{customer.companyName}</div>
              </div>
            )}
            {customer.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ direction: 'ltr' }}>{customer.phone}</span>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.currency}</div>
              <div style={{ fontWeight: 600 }}>{customer.currency}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.totalInvoiced}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(totalInvoiced.toFixed(2), customer.currency)}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.totalPaid}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-success)' }}>
              {formatCurrency(totalPaid.toFixed(2), customer.currency)}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.currentBalance}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: customer.balance.gt(0) ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {formatCurrency(customer.balance.toString(), customer.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem' }}>
          <span className="card-title">{t.invoiceHistory}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.invoiceNum}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.date}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>{t.total}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>{t.balanceDue}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {customer.sales.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {t.noInvoices}
                  </td>
                </tr>
              ) : (
                customer.sales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <Link href={`/b/${businessId}/sales/${sale.id}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 600 }}>
                        {sale.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatDate(sale.invoiceDate)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(sale.totalAmount.toString(), sale.currencyCode)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: sale.balanceDue.gt(0) ? 'var(--color-danger)' : 'var(--color-success)', textAlign: isAr ? 'left' : 'right' }}>
                      {formatCurrency(sale.balanceDue.toString(), sale.currencyCode)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge badge-${sale.status === 'paid' ? 'success' : sale.status === 'partial' ? 'warning' : 'primary'}`}>
                        {t.statuses[sale.status] || sale.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
