import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PrintButton } from '@/components/reports/print-button'

export const metadata: Metadata = {
  title: 'Cash Flow Statement | AccountFlow',
  description: 'Statement of Cash Flows — Operating, Investing, and Financing Activities',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ fromDate?: string; toDate?: string }>
}

export default async function CashFlowPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = (await searchParams) || {}
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1)
  const fromDate = sp.fromDate ? new Date(sp.fromDate) : defaultFrom
  const toDate = sp.toDate ? new Date(sp.toDate) : now

  const cf = await ReportingService.getCashFlow(businessId, fromDate, toDate)
  const currency = cf.currency
  const isPos = (n: number) => n >= 0

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
            <span>{isAr ? 'التدفقات النقدية' : isTr ? 'Nakit Akışı' : 'Cash Flow'}</span>
          </div>
          <h1 className="page-title">
            {isAr ? 'قائمة التدفقات النقدية' : isTr ? 'Nakit Akış Tablosu' : 'Cash Flow Statement'}
          </h1>
          <p className="page-subtitle">
            {business.name} · {cf.fromDate} {isAr ? 'إلى' : isTr ? '-' : 'to'} {cf.toDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" name="fromDate" defaultValue={cf.fromDate} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{isAr ? 'إلى' : isTr ? '-' : 'to'}</span>
            <input type="date" name="toDate" defaultValue={cf.toDate} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {isAr ? 'تطبيق' : isTr ? 'Uygula' : 'Apply'}
            </button>
          </form>
          <PrintButton id="cf-print-btn" targetId="printable-cf-report" title={isAr ? 'قائمة التدفقات النقدية' : 'Cash Flow Statement'} />
        </div>
      </div>

      <div id="printable-cf-report" className="report-paper-card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* Printable Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
              {isAr ? 'قائمة التدفقات النقدية' : 'Cash Flow Statement'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.2rem' }}>
              {business.name} · {cf.fromDate} {isAr ? 'إلى' : 'to'} {cf.toDate}
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', background: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {currency} ({currency === 'USD' ? 'US Dollar' : currency})
          </div>
        </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard
          label={isAr ? 'رصيد النقدية الافتتاحي' : isTr ? 'Dönem Başı Nakit Bakiyesi' : 'Opening Cash Balance'}
          value={formatCurrency(cf.openingCash.toFixed(2), currency)}
          sub={isAr ? 'بداية الفترة المالية' : isTr ? 'Dönem başı' : 'Beginning of period'}
          color="var(--color-info)"
        />
        <SummaryCard
          label={isAr ? 'صافي التدفق النقدي' : isTr ? 'Net Nakit Akışı' : 'Net Cash Flow'}
          value={formatCurrency(cf.netCashFlow.toFixed(2), currency)}
          sub={cf.netCashFlow >= 0 ? (isAr ? '📈 صافي تدفق نقدي داخل' : isTr ? '📈 Net Nakit Girişi' : '📈 Net Cash Inflow') : (isAr ? '📉 صافي تدفق نقدي خارج' : isTr ? '📉 Net Nakit Çıkışı' : '📉 Net Cash Outflow')}
          color={cf.netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
        <SummaryCard
          label={isAr ? 'رصيد النقدية الختامي' : isTr ? 'Dönem Sonu Nakit Bakiyesi' : 'Closing Cash Balance'}
          value={formatCurrency(cf.closingCash.toFixed(2), currency)}
          sub={isAr ? 'نهاية الفترة المالية' : isTr ? 'Dönem sonu' : 'End of period'}
          color="var(--color-brand-500)"
        />
      </div>

      {/* Statement */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', color: 'white' }}>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.8125rem', fontWeight: 600 }}>
                {isAr ? 'النشاط والبيان' : isTr ? 'Faaliyet' : 'Activity'}
              </th>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, width: '200px' }}>
                {isAr ? 'المقبوضات (تدفق داخل)' : isTr ? 'Nakit Girişi' : 'Cash Inflow'}
              </th>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, width: '200px' }}>
                {isAr ? 'المدفوعات (تدفق خارج)' : isTr ? 'Nakit Çıkışı' : 'Cash Outflow'}
              </th>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, width: '200px' }}>
                {isAr ? 'الصافي' : isTr ? 'Net' : 'Net'}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Operating */}
            <SectionHeader label={isAr ? 'الأنشطة التشغيلية (OPERATING ACTIVITIES)' : isTr ? 'İŞLETME FAALİYETLERİ' : 'OPERATING ACTIVITIES'} />
            {cf.operating.items.map((item, i) => (
              <ActivityRow key={i} label={item.label} amount={item.amount} currency={currency} isAr={isAr} />
            ))}
            <SectionTotal label={isAr ? 'صافي النقد من الأنشطة التشغيلية' : isTr ? 'İşletme Faaliyetlerinden Net Nakit' : 'Net Cash from Operating Activities'} amount={cf.operating.total} currency={currency} color="#6366f1" isAr={isAr} />

            {/* Investing */}
            <SectionHeader label={isAr ? 'الأنشطة الاستثمارية (INVESTING ACTIVITIES)' : isTr ? 'YATIRIM FAALİYETLERİ' : 'INVESTING ACTIVITIES'} />
            {cf.investing.items.map((item, i) => (
              <ActivityRow key={i} label={item.label} amount={item.amount} currency={currency} isAr={isAr} />
            ))}
            <SectionTotal label={isAr ? 'صافي النقد من الأنشطة الاستثمارية' : isTr ? 'Yatırım Faaliyetlerinden Net Nakit' : 'Net Cash from Investing Activities'} amount={cf.investing.total} currency={currency} color="#f59e0b" isAr={isAr} />

            {/* Financing */}
            <SectionHeader label={isAr ? 'الأنشطة التمويلية (FINANCING ACTIVITIES)' : isTr ? 'FİNANSMAN FAALİYETLERİ' : 'FINANCING ACTIVITIES'} />
            {cf.financing.items.map((item, i) => (
              <ActivityRow key={i} label={item.label} amount={item.amount} currency={currency} isAr={isAr} />
            ))}
            <SectionTotal label={isAr ? 'صافي النقد من الأنشطة التمويلية' : isTr ? 'Finansman Faaliyetlerinden Net Nakit' : 'Net Cash from Financing Activities'} amount={cf.financing.total} currency={currency} color="#10b981" isAr={isAr} />

            {/* Summary */}
            <tr style={{ background: 'var(--bg-page)', borderTop: '2px solid var(--border-color)' }}>
              <td colSpan={4} style={{ padding: '0.5rem' }} />
            </tr>
            <tr style={{ background: 'rgba(99,102,241,0.06)', borderTop: '2px solid var(--border-color)' }}>
              <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700, fontSize: '0.875rem' }}>
                {isAr ? 'رصيد النقدية الافتتاحي' : isTr ? 'Dönem Başı Nakit Bakiyesi' : 'Opening Cash Balance'}
              </td>
              <td colSpan={2} />
              <td style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontWeight: 700 }}>
                {formatCurrency(cf.openingCash.toFixed(2), currency)}
              </td>
            </tr>
            <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
              <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700, fontSize: '0.875rem' }}>
                {isAr ? 'صافي التدفق النقدي للفترة' : isTr ? 'Dönem Net Nakit Akışı' : 'Net Cash Flow'}
              </td>
              <td colSpan={2} />
              <td style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: isPos(cf.netCashFlow) ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {isPos(cf.netCashFlow) ? '+' : ''}{formatCurrency(cf.netCashFlow.toFixed(2), currency)}
              </td>
            </tr>
            <tr style={{ background: 'rgba(99,102,241,0.1)', borderTop: '1px solid var(--border-color)' }}>
              <td style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.9375rem', fontFamily: 'Outfit, sans-serif', color: 'var(--color-brand-500)' }}>
                {isAr ? 'رصيد النقدية الختامي' : isTr ? 'DÖNEM SONU NAKİT BAKİYESİ' : 'CLOSING CASH BALANCE'}
              </td>
              <td colSpan={2} />
              <td style={{ padding: '1rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontWeight: 800, fontSize: '1.125rem', fontFamily: 'Outfit, sans-serif', color: 'var(--color-brand-500)' }}>
                {formatCurrency(cf.closingCash.toFixed(2), currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card" style={{ padding: '1.25rem', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color, marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr style={{ background: 'var(--bg-page)' }}>
      <td colSpan={4} style={{ padding: '0.625rem 1.25rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </td>
    </tr>
  )
}

function ActivityRow({ label, amount, currency, isAr }: { label: string; amount: number; currency: string; isAr?: boolean }) {
  const fmt = (n: number) => formatCurrency(Math.abs(n).toFixed(2), currency)
  const inflow = amount > 0 ? fmt(amount) : '—'
  const outflow = amount < 0 ? fmt(amount) : '—'
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
      <td style={{ padding: '0.625rem 1.25rem', [isAr ? 'paddingRight' : 'paddingLeft']: '2.5rem', fontSize: '0.875rem' }}>{label}</td>
      <td style={{ padding: '0.625rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', color: 'var(--color-success)', fontWeight: amount > 0 ? 600 : 400 }}>
        {inflow}
      </td>
      <td style={{ padding: '0.625rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', color: 'var(--color-danger)', fontWeight: amount < 0 ? 600 : 400 }}>
        {outflow}
      </td>
      <td style={{ padding: '0.625rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 500, color: amount >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
        {amount !== 0 ? formatCurrency(amount.toFixed(2), currency) : '—'}
      </td>
    </tr>
  )
}

function SectionTotal({ label, amount, currency, color, isAr }: { label: string; amount: number; currency: string; color: string; isAr?: boolean }) {
  return (
    <tr style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
      <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, color }}>{label}</td>
      <td colSpan={2} />
      <td style={{ padding: '0.75rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.9375rem', fontWeight: 700, color: amount >= 0 ? color : 'var(--color-danger)' }}>
        {amount >= 0 ? '+' : ''}{formatCurrency(amount.toFixed(2), currency)}
      </td>
    </tr>
  )
}
