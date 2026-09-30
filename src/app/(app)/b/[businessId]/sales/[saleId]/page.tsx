import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Printer, FileText, CheckCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/decimal'

export const metadata: Metadata = {
  title: 'Invoice Detail | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; saleId: string }>
}

export default async function SalesInvoiceDetailPage({ params }: PageProps) {
  const { businessId, saleId } = await params
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(saleId)) {
    notFound()
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, businessId },
    include: {
      customer: true,
      items: {
        include: { product: true, warehouse: true },
      },
      paymentAllocations: {
        include: { payment: true },
      },
    },
  })

  if (!sale) notFound()

  // Find linked Journal Entry if posted
  const journalEntry = await prisma.journalEntry.findFirst({
    where: { businessId, sourceType: 'sale', sourceId: sale.id },
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
          label: isAr ? 'مرحلة / غير مسددة' : isTr ? 'Açık / Ödenmedi' : 'Posted / Unpaid',
          cls: 'badge-primary',
        }
    }
  }

  const statusInfo = getStatusBadge(sale.status)

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/b/${businessId}/sales`}
            className="btn btn-secondary"
            style={{ width: 40, height: 40, padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isAr ? 'الرجوع لفواتير المبيعات' : isTr ? 'Faturalara Dön' : 'Back to Invoices'}
          >
            <ArrowLeft size={18} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="page-title">
                {isAr ? `فاتورة مبيعات #${sale.invoiceNumber}` : isTr ? `Satış Faturası #${sale.invoiceNumber}` : `Invoice #${sale.invoiceNumber}`}
              </h1>
              <span className={`badge ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="page-subtitle">
              {isAr ? `تاريخ الإصدار: ${formatDate(sale.invoiceDate)}` : isTr ? `Fatura Tarihi: ${formatDate(sale.invoiceDate)}` : `Created on ${formatDate(sale.invoiceDate)}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/sales/${saleId}/invoice`} className="btn btn-secondary">
            <Printer size={16} />
            {isAr ? 'طباعة الفاتورة' : isTr ? 'Yazdır' : 'Print Invoice'}
          </Link>
          <Link href={`/b/${businessId}/payments`} className="btn btn-primary">
            {isAr ? 'تسجيل سند قبض' : isTr ? 'Tahsilat Kaydet' : 'Record Payment'}
          </Link>
        </div>
      </div>

      {/* Invoice Document Layout */}
      <div className="card" style={{ padding: '2.5rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        {/* Top Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{business.name}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {isAr ? 'الرقم الضريبي: ' : isTr ? 'Vergi No: ' : 'Tax ID: '}
              {business.taxNumber || '—'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{business.country || (isAr ? 'عالمي' : isTr ? 'Küresel' : 'Global')}</p>
          </div>

          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isAr ? 'فاتورة ضريبية' : isTr ? 'SATIŞ FATURASI' : 'INVOICE'}
            </h3>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{sale.invoiceNumber}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {isAr ? 'التاريخ: ' : isTr ? 'Tarih: ' : 'Date: '}{formatDate(sale.invoiceDate)}
            </p>
            {sale.dueDate && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {isAr ? 'الاستحقاق: ' : isTr ? 'Vade: ' : 'Due: '}{formatDate(sale.dueDate)}
              </p>
            )}
          </div>
        </div>

        {/* Billed To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {isAr ? 'فاتورة إلى (العميل)' : isTr ? 'Fatura Edilen Müşteri' : 'Billed To'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {sale.customer?.name || (isAr ? 'عميل نقدي عام' : isTr ? 'Perakende Müşteri' : 'Walk-in Customer')}
            </div>
            {sale.customer?.companyName && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{sale.customer.companyName}</div>}
            {sale.customer?.email && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{sale.customer.email}</div>}
            {sale.customer?.address && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{sale.customer.address}</div>}
          </div>

          <div style={{ background: 'var(--bg-page)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {isAr ? 'الملخص المالي' : isTr ? 'Finansal Özet' : 'Financial Summary'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <span>{isAr ? 'إجمالي الفاتورة:' : isTr ? 'Fatura Toplamı:' : 'Invoice Total:'}</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(sale.totalAmount.toString(), sale.currencyCode)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <span>{isAr ? 'المبلغ المسدد:' : isTr ? 'Ödenen Tutar:' : 'Amount Paid:'}</span>
              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(sale.paidAmount.toString(), sale.currencyCode)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span>{isAr ? 'الرصيد المتبقي:' : isTr ? 'Kalan Bakiye:' : 'Balance Due:'}</span>
              <span style={{ color: sale.balanceDue.gt(0) ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {formatCurrency(sale.balanceDue.toString(), sale.currencyCode)}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الصنف والبيان' : isTr ? 'Kalem ve Açıklama' : 'Item & Description'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: 'center' }}>
                  {isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty'}
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                  {isAr ? 'سعر الوحدة' : isTr ? 'Birim Fiyat' : 'Unit Price'}
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
              {sale.items.map((line: any) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600 }}>{line.product?.name || line.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{line.description}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: 'center' }}>{line.quantity.toString()}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(line.unitPrice.toString(), sale.currencyCode)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right' }}>{formatCurrency(line.taxAmount.toString(), sale.currencyCode)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(line.totalAmount.toString(), sale.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes & Terms */}
        {(sale.notes || sale.terms) && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {sale.notes && <p><strong>{isAr ? 'الملاحظات: ' : isTr ? 'Notlar: ' : 'Notes: '}</strong>{sale.notes}</p>}
            {sale.terms && <p style={{ marginTop: '0.25rem' }}><strong>{isAr ? 'الشروط: ' : isTr ? 'Şartlar: ' : 'Terms: '}</strong>{sale.terms}</p>}
          </div>
        )}
      </div>

      {/* Linked Accounting Journal Entry */}
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
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: isAr ? 'right' : 'left' }}>
                    {isAr ? 'البيان' : isTr ? 'Açıklama' : 'Description'}
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
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{l.description || '—'}</td>
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
