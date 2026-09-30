import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AR & AP Aging | AccountFlow',
  description: 'Accounts Receivable and Payable Aging Analysis',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ asOfDate?: string; view?: string }>
}

export default async function AgingPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = (await searchParams) || {}
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const asOfDate = sp.asOfDate ? new Date(sp.asOfDate) : new Date()
  const view = sp.view || 'ar'

  const [ar, ap] = await Promise.all([
    ReportingService.getARAgingSummary(businessId, asOfDate),
    ReportingService.getAPAgingSummary(businessId, asOfDate),
  ])

  const currency = ar.currency
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)

  const agingData = view === 'ar' ? ar : ap
  const rows = view === 'ar' ? ar.rows : ap.rows
  const buckets = agingData.buckets

  const bucketCols = [
    { key: 'current' as const, label: isAr ? 'حالية غير متأخرة' : isTr ? 'Vadesi Gelmemiş' : 'Current', color: 'var(--color-success)' },
    { key: 'days1to30' as const, label: isAr ? '1 - 30 يوماً' : isTr ? '1-30 Gün' : '1-30 Days', color: 'var(--color-warning)' },
    { key: 'days31to60' as const, label: isAr ? '31 - 60 يوماً' : isTr ? '31-60 Gün' : '31-60 Days', color: '#f97316' },
    { key: 'days61to90' as const, label: isAr ? '61 - 90 يوماً' : isTr ? '61-90 Gün' : '61-90 Days', color: 'var(--color-danger)' },
    { key: 'days90plus' as const, label: isAr ? '+90 يوماً فأكثر' : isTr ? '90+ Gün' : '90+ Days', color: '#7f1d1d' },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/reports`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isAr ? 'التقارير المالية' : isTr ? 'Raporlar' : 'Reports'}
            </Link>
            <ChevronRight size={12} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
            <span>{isAr ? 'أعمار الديون' : isTr ? 'Yaşlandırma Analizi' : 'Aging Analysis'}</span>
          </div>
          <h1 className="page-title">
            {isAr ? 'تحليل أعمار ذمم العملاء والموردين (AR & AP)' : isTr ? 'Alacak ve Borç Yaşlandırma Analizi' : 'AR & AP Aging Analysis'}
          </h1>
          <p className="page-subtitle">
            {business.name} · {isAr ? 'كما في' : isTr ? 'İtibarıyla' : 'As of'} {agingData.asOfDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="hidden" name="view" value={view} />
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {isAr ? 'في تاريخ:' : isTr ? 'Tarih:' : 'As of:'}
            </label>
            <input type="date" name="asOfDate" defaultValue={agingData.asOfDate} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {isAr ? 'تطبيق' : isTr ? 'Uygula' : 'Apply'}
            </button>
          </form>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link
          href={`/b/${businessId}/reports/aging?view=ar&asOfDate=${agingData.asOfDate}`}
          className={`btn btn-sm ${view === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
          id="aging-ar-tab"
        >
          {isAr ? 'ذمم العملاء المدينة (A/R) — ' : isTr ? 'Alacak Hesapları (A/R) — ' : 'Accounts Receivable (A/R) — '}{fmt(ar.buckets.total)}
        </Link>
        <Link
          href={`/b/${businessId}/reports/aging?view=ap&asOfDate=${agingData.asOfDate}`}
          className={`btn btn-sm ${view === 'ap' ? 'btn-primary' : 'btn-secondary'}`}
          id="aging-ap-tab"
        >
          {isAr ? 'ذمم الموردين الدائنة (A/P) — ' : isTr ? 'Borç Hesapları (A/P) — ' : 'Accounts Payable (A/P) — '}{fmt(ap.buckets.total)}
        </Link>
      </div>

      {/* Aging Bucket Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {bucketCols.map((col) => (
          <div key={col.key} className="card" style={{ padding: '1rem', borderTop: `3px solid ${col.color}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem', fontWeight: 500 }}>{col.label}</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: col.color }}>
              {fmt(buckets[col.key])}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {buckets.total > 0 ? `${((buckets[col.key] / buckets.total) * 100).toFixed(1)}%` : '0%'} {isAr ? 'من الإجمالي' : isTr ? 'toplamın' : 'of total'}
            </div>
          </div>
        ))}
      </div>

      {/* Grand Total Banner */}
      <div className="card" style={{
        padding: '1rem 1.5rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-200)',
      }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-brand-700)' }}>
          {isAr
            ? `إجمالي الذمم ${view === 'ar' ? 'المدينة المستحقة على العملاء' : 'الدائنة المستحقة للموردين'}`
            : isTr
            ? `Toplam ${view === 'ar' ? 'Müşteri Alacakları' : 'Tedarikçi Borçları'}`
            : `Total Outstanding ${view === 'ar' ? 'Receivables' : 'Payables'}`}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--color-brand-600)' }}>
          {fmt(buckets.total)}
        </span>
      </div>

      {/* Aging Detail Table */}
      {rows.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {isAr
              ? `لا توجد ذمم ${view === 'ar' ? 'مدينة مستحقة' : 'دائنة متأخرة'}`
              : isTr
              ? `Vadesi geçmiş ${view === 'ar' ? 'alacak' : 'borç'} bulunmuyor`
              : `No Outstanding ${view === 'ar' ? 'Receivables' : 'Payables'}`}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isAr
              ? `جميع ${view === 'ar' ? 'فواتير العملاء' : 'فواتير الموردين'} مسددة بالكامل حتى تاريخ ${agingData.asOfDate}.`
              : isTr
              ? `Tüm ${view === 'ar' ? 'müşteri faturaları' : 'tedarikçi faturaları'} ${agingData.asOfDate} itibarıyla tamamen ödenmiştir.`
              : `All ${view === 'ar' ? 'customer invoices' : 'supplier bills'} are fully settled as of ${agingData.asOfDate}.`}
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sidebar)', color: 'white' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                    {view === 'ar' ? (isAr ? 'رقم الفاتورة' : isTr ? 'Fatura No' : 'Invoice #') : (isAr ? 'رقم الشراء' : isTr ? 'Alış No' : 'Purchase #')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                    {view === 'ar' ? (isAr ? 'العميل' : isTr ? 'Müşteri' : 'Customer') : (isAr ? 'المورد' : isTr ? 'Tedarikçi' : 'Supplier')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'الاستحقاق' : isTr ? 'Vade Tarihi' : 'Due Date'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'الإجمالي' : isTr ? 'Toplam' : 'Total'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'المسدد' : isTr ? 'Ödenen' : 'Paid'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'المتبقي' : isTr ? 'Kalan Bakiye' : 'Balance Due'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'العمر (أيام)' : isTr ? 'Gün' : 'Age (Days)'}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                    {isAr ? 'الشريحة' : isTr ? 'Dilim' : 'Bucket'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const bucketInfo = bucketCols.find((b) => b.key === row.bucket)
                  return (
                    <tr key={row.invoiceId || row.purchaseId} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>
                        <Link
                          href={`/b/${businessId}/${view === 'ar' ? 'sales' : 'purchases'}/${row.invoiceId || row.purchaseId}`}
                          style={{ color: 'var(--color-brand-500)', textDecoration: 'none' }}
                        >
                          {row.invoiceNumber || row.purchaseNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}>{row.customerName || row.supplierName}</td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {row.invoiceDate || row.purchaseDate}
                      </td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {row.dueDate || '—'}
                      </td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem' }}>{fmt(row.totalAmount)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', color: 'var(--color-success)' }}>{fmt(row.paidAmount)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(row.balanceDue)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: row.ageDays > 60 ? 'var(--color-danger)' : row.ageDays > 30 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                        {row.ageDays}
                      </td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          background: `${bucketInfo?.color}20`,
                          color: bucketInfo?.color,
                        }}>
                          {bucketInfo?.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-page)', borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={4} style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.875rem' }}>
                    {isAr ? 'الإجمالي العام' : isTr ? 'GENEL TOPLAM' : 'TOTAL'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: isAr ? 'left' : 'right', fontWeight: 700 }}>
                    {fmt(rows.reduce((s: number, r: any) => s + r.totalAmount, 0))}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                    {fmt(rows.reduce((s: number, r: any) => s + r.paidAmount, 0))}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: isAr ? 'left' : 'right', fontWeight: 800, color: 'var(--color-danger)' }}>
                    {fmt(buckets.total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
