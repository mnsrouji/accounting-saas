import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Mail, Phone, Package, DollarSign } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/decimal'

export const metadata: Metadata = {
  title: 'Supplier Statement | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; supplierId: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { businessId, supplierId } = await params
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(supplierId)) {
    notFound()
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId },
    include: {
      purchases: { orderBy: { purchaseDate: 'desc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })

  if (!supplier) notFound()

  const totalPurchased = supplier.purchases.reduce((acc, p) => acc.plus(p.totalAmount.toString()), new (require('decimal.js'))(0))
  const totalPaid = supplier.payments.reduce((acc, p) => acc.plus(p.amount.toString()), new (require('decimal.js'))(0))

  const t = {
    back: isAr ? 'الرجوع للموردين' : isTr ? 'Tedarikçilere Dön' : 'Back to Suppliers',
    subtitle: isAr ? 'كشف وحساب المورد' : isTr ? 'Tedarikçi Hesabı ve Ekstresi' : 'Supplier Account & Statement',
    recordPurchase: isAr ? 'فاتورة مشتريات' : isTr ? 'Alış Faturası' : 'Record Purchase',
    makePayment: isAr ? 'سند صرف' : isTr ? 'Ödeme Yap' : 'Make Payment',
    infoTitle: isAr ? 'بيانات المورد' : isTr ? 'Tedarikçi Bilgileri' : 'Supplier Details',
    supplierCode: isAr ? 'كود المورد' : isTr ? 'Tedarikçi Kodu' : 'Supplier Code',
    company: isAr ? 'الشركة / المؤسسة' : isTr ? 'Şirket' : 'Company',
    currency: isAr ? 'العملة المفضلة' : isTr ? 'Para Birimi' : 'Preferred Currency',
    totalPurchased: isAr ? 'إجمالي المشتريات' : isTr ? 'Toplam Satın Alınan' : 'Total Purchased',
    totalPaid: isAr ? 'إجمالي المدفوعات' : isTr ? 'Toplam Ödenen' : 'Total Payments Made',
    payableBalance: isAr ? 'الرصيد المستحق للمورد' : isTr ? 'Ödenecek Bakiye' : 'Payable Balance',
    billHistory: isAr ? 'سجل فواتير المشتريات' : isTr ? 'Alış Faturaları Geçmişi' : 'Purchase Bill History',
    purchaseNum: isAr ? 'رقم الفاتورة' : isTr ? 'Fatura No' : 'Purchase #',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    total: isAr ? 'الإجمالي' : isTr ? 'Toplam' : 'Total',
    balanceDue: isAr ? 'المتبقي' : isTr ? 'Kalan Tutar' : 'Balance Due',
    status: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    noPurchases: isAr ? 'لا توجد فواتير مشتريات مسجلة لهذا المورد حتى الآن.' : isTr ? 'Bu tedarikçi için henüz alış faturası kaydedilmedi.' : 'No purchase bills recorded for this supplier.',
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
          <Link href={`/b/${businessId}/suppliers`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t.back}>
            <ArrowLeft size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <h1 className="page-title">{supplier.name}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/purchases/new`} className="btn btn-primary btn-sm">
            {t.recordPurchase}
          </Link>
          <Link href={`/b/${businessId}/payments/outgoing/new`} className="btn btn-secondary btn-sm">
            {t.makePayment}
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.infoTitle}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.supplierCode}</div>
              <div style={{ fontWeight: 600 }}>{supplier.code}</div>
            </div>
            {supplier.companyName && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.company}</div>
                <div>{supplier.companyName}</div>
              </div>
            )}
            {supplier.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                <span>{supplier.email}</span>
              </div>
            )}
            {supplier.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ direction: 'ltr' }}>{supplier.phone}</span>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.currency}</div>
              <div style={{ fontWeight: 600 }}>{supplier.currency}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.totalPurchased}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(totalPurchased.toFixed(2), supplier.currency)}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.totalPaid}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-success)' }}>
              {formatCurrency(totalPaid.toFixed(2), supplier.currency)}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.payableBalance}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: supplier.balance.gt(0) ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {formatCurrency(supplier.balance.toString(), supplier.currency)}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem' }}>
          <span className="card-title">{t.billHistory}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.purchaseNum}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.date}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>{t.total}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>{t.balanceDue}</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {supplier.purchases.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {t.noPurchases}
                  </td>
                </tr>
              ) : (
                supplier.purchases.map((purch) => (
                  <tr key={purch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <Link href={`/b/${businessId}/purchases/${purch.id}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 600 }}>
                        {purch.purchaseNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatDate(purch.purchaseDate)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(purch.totalAmount.toString(), purch.currencyCode)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: purch.balanceDue.gt(0) ? 'var(--color-danger)' : 'var(--color-success)', textAlign: isAr ? 'left' : 'right' }}>
                      {formatCurrency(purch.balanceDue.toString(), purch.currencyCode)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge badge-${purch.status === 'paid' ? 'success' : purch.status === 'partial' ? 'warning' : 'primary'}`}>
                        {t.statuses[purch.status] || purch.status}
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
