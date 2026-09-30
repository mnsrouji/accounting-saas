import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Printer, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/decimal'

export const metadata: Metadata = {
  title: 'Purchase Bill Detail | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; purchaseId: string }>
}

export default async function PurchaseInvoiceDetailPage({ params }: PageProps) {
  const { businessId, purchaseId } = await params
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(purchaseId)) {
    notFound()
  }

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, businessId },
    include: {
      supplier: true,
      items: {
        include: { product: true, warehouse: true },
      },
      paymentAllocations: {
        include: { payment: true },
      },
    },
  })

  if (!purchase) notFound()

  // Find linked GL Entry
  const journalEntry = await prisma.journalEntry.findFirst({
    where: { businessId, sourceType: 'purchase', sourceId: purchase.id },
    include: { lines: { include: { account: true } } },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          label: isAr ? 'مسددة بالكامل' : isTr ? 'Ödendi' : 'Paid',
          cls: 'badge-success',
        }
      case 'partial':
        return {
          label: isAr ? 'مسددة جزئياً' : isTr ? 'Kısmi Ödeme' : 'Partial',
          cls: 'badge-warning',
        }
      default:
        return {
          label: isAr ? 'مرحلة / مستحقة السداد' : isTr ? 'Açık / Ödenmedi' : 'Posted / Unpaid',
          cls: 'badge-primary',
        }
    }
  }

  const statusInfo = getStatusBadge(purchase.status)

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/b/${businessId}/purchases`}
            className="btn btn-secondary"
            style={{ width: 40, height: 40, padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isAr ? 'الرجوع لفواتير المشتريات' : isTr ? 'Alış Faturalarına Dön' : 'Back to Purchases'}
          >
            <ArrowLeft size={18} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="page-title">
                {isAr ? `فاتورة مشتريات #${purchase.purchaseNumber}` : isTr ? `Alış Faturası #${purchase.purchaseNumber}` : `Purchase Bill #${purchase.purchaseNumber}`}
              </h1>
              <span className={`badge ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="page-subtitle">
              {isAr ? `تاريخ الفاتورة: ${formatDate(purchase.purchaseDate)}` : isTr ? `Fatura Tarihi: ${formatDate(purchase.purchaseDate)}` : `Bill Date: ${formatDate(purchase.purchaseDate)}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/purchases/${purchaseId}/bill`} className="btn btn-secondary">
            <Printer size={16} />
            {isAr ? 'طباعة الفاتورة' : isTr ? 'Yazdır' : 'Print Bill'}
          </Link>
          <Link href={`/b/${businessId}/payments`} className="btn btn-primary">
            {isAr ? 'تسجيل سند صرف' : isTr ? 'Ödeme Kaydet' : 'Make Payment'}
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: '2.5rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)' }}>
              {purchase.supplier?.name || (isAr ? 'المورد' : isTr ? 'Tedarikçi' : 'Supplier')}
            </h2>
            {purchase.supplier?.companyName && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{purchase.supplier.companyName}</p>}
            {purchase.supplier?.email && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{purchase.supplier.email}</p>}
          </div>

          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isAr ? 'فاتورة مشتريات' : isTr ? 'ALIŞ FATURASI' : 'PURCHASE BILL'}
            </h3>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{purchase.purchaseNumber}</p>
            {purchase.referenceNumber && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {isAr ? 'المرجع: ' : isTr ? 'Ref: ' : 'Ref: '}{purchase.referenceNumber}
              </p>
            )}
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {isAr ? 'التاريخ: ' : isTr ? 'Tarih: ' : 'Date: '}{formatDate(purchase.purchaseDate)}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الصنف والبيان' : isTr ? 'Kalem ve Açıklama' : 'Item & Description'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: 'center' }}>
                  {isAr ? 'مستودع الاستلام' : isTr ? 'Giriş Deposu' : 'Receiving Warehouse'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: 'center' }}>
                  {isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                  {isAr ? 'تكلفة الوحدة' : isTr ? 'Birim Maliyet' : 'Unit Cost'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                  {isAr ? 'الضريبة' : isTr ? 'Vergi' : 'Tax'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                  {isAr ? 'الإجمالي' : isTr ? 'Toplam' : 'Total'}
                </th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((line: any) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600 }}>{line.product?.name || line.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{line.description}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {line.warehouse?.name || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: 'center' }}>{line.quantity.toString()}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(line.unitPrice.toString(), purchase.currencyCode)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(line.taxAmount.toString(), purchase.currencyCode)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(line.totalAmount.toString(), purchase.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {journalEntry && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} />
              {isAr ? `قيد اليومية المحاسبي المرتبط (${journalEntry.entryNumber})` : isTr ? `Bağlı Muhasebe Yevmiye Kaydı (${journalEntry.entryNumber})` : `Linked Accounting Journal Entry (${journalEntry.entryNumber})`}
            </span>
            <span className="badge badge-success">
              {isAr ? 'مرحل' : isTr ? 'İşlendi' : journalEntry.status}
            </span>
          </div>
          <div style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>
                    {isAr ? 'الحساب' : isTr ? 'Hesap' : 'Account'}
                  </th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                    {isAr ? 'مدين' : isTr ? 'Borç' : 'Debit'}
                  </th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                    {isAr ? 'دائن' : isTr ? 'Alacak' : 'Credit'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {journalEntry.lines.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      {l.account?.code} - {l.account?.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right', fontWeight: l.debitAmount.gt(0) ? 600 : 400 }}>
                      {l.debitAmount.gt(0) ? formatCurrency(l.debitAmount.toString(), journalEntry.currencyCode) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right', fontWeight: l.creditAmount.gt(0) ? 600 : 400 }}>
                      {l.creditAmount.gt(0) ? formatCurrency(l.creditAmount.toString(), journalEntry.currencyCode) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
