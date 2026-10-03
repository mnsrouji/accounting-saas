import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { PrintButton } from '@/components/reports/print-button'
import { getLocalizedAccountName } from '@/lib/i18n/account-i18n'

export const metadata: Metadata = {
  title: 'Profit & Loss | AccountFlow',
  description: 'Income Statement — Revenue, Gross Profit, Operating Profit, and Net Income',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ fromDate?: string; toDate?: string }>
}

export default async function ProfitAndLossPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = (await searchParams) || {}
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1) // YTD
  const fromDate = sp.fromDate ? new Date(sp.fromDate) : defaultFrom
  const toDate = sp.toDate ? new Date(sp.toDate) : now

  const pl = await ReportingService.getProfitAndLoss(businessId, fromDate, toDate)
  const currency = pl.currency

  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)
  const pct = (n: number, base: number) =>
    base !== 0 ? `${((n / base) * 100).toFixed(1)}%` : '—'

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
            <span>{isAr ? 'الأرباح والخسائر' : isTr ? 'Gelir Tablosu' : 'Profit & Loss'}</span>
          </div>
          <h1 className="page-title">
            {isAr ? 'قائمة الأرباح والخسائر (الدخل)' : isTr ? 'Gelir Tablosu (Kâr ve Zarar)' : 'Profit & Loss Statement'}
          </h1>
          <p className="page-subtitle">
            {business.name} · {pl.fromDate} {isAr ? 'إلى' : isTr ? '-' : 'to'} {pl.toDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" name="fromDate" defaultValue={pl.fromDate} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isAr ? 'إلى' : isTr ? '-' : 'to'}</span>
            <input type="date" name="toDate" defaultValue={pl.toDate} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {isAr ? 'تطبيق' : isTr ? 'Uygula' : 'Apply'}
            </button>
          </form>
          <PrintButton id="pl-print-btn" targetId="printable-pl-report" title={isAr ? 'قائمة الأرباح والخسائر' : 'Profit & Loss Statement'} />
        </div>
      </div>

      <div id="printable-pl-report" className="report-paper-card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* Printable Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
              {isAr ? 'قائمة الأرباح والخسائر (الدخل)' : 'Profit & Loss Statement'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.2rem' }}>
              {business.name} · {pl.fromDate} {isAr ? 'إلى' : 'to'} {pl.toDate}
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', background: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {currency} ({currency === 'USD' ? 'US Dollar' : currency})
          </div>
        </div>

      {/* Net Result Banner */}
      <div className="card" style={{
        padding: '1.5rem',
        marginBottom: '1.5rem',
        background: pl.isProfit
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.04) 100%)'
          : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(185,28,28,0.04) 100%)',
        border: `1px solid ${pl.isProfit ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: pl.isProfit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: pl.isProfit ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {pl.isProfit ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {pl.isProfit ? (isAr ? 'صافي الربح' : isTr ? 'Net Kâr' : 'Net Profit') : (isAr ? 'صافي الخسارة' : isTr ? 'Net Zarar' : 'Net Loss')}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: pl.isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {fmt(Math.abs(pl.netProfit))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'مجمل الربح' : isTr ? 'Brüt Kâr' : 'Gross Profit'}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: pl.grossProfit >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>{fmt(pl.grossProfit)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'هامش ' : isTr ? 'marjı ' : ''}{pct(pl.grossProfit, pl.revenue.total)}{!isAr && !isTr ? ' margin' : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'الربح التشغيلي' : isTr ? 'Faaliyet Kârı' : 'Operating Profit'}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: pl.operatingProfit >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>{fmt(pl.operatingProfit)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'هامش ' : isTr ? 'marjı ' : ''}{pct(pl.operatingProfit, pl.revenue.total)}{!isAr && !isTr ? ' margin' : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'الإيرادات' : isTr ? 'Gelirler' : 'Revenue'}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(pl.revenue.total)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'إجمالي المبيعات' : isTr ? 'Brüt Satışlar' : 'Gross Sales'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* P&L Statement Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', color: 'white' }}>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.8125rem', fontWeight: 600 }}>
                {isAr ? 'الحساب' : isTr ? 'Hesap' : 'Account'}
              </th>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, width: '180px' }}>
                {isAr ? `المبلغ (${currency})` : isTr ? `Tutar (${currency})` : `Amount (${currency})`}
              </th>
              <th style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, width: '120px' }}>
                {isAr ? 'نسبة الإيراد %' : isTr ? 'Gelir %' : '% Revenue'}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <SectionHeader label={isAr ? 'الإيرادات والمبيعات' : isTr ? 'GELİRLER' : 'REVENUE'} />
            {pl.revenue.items.map((item) => (
              <AccountRow key={item.accountId} code={item.code} name={getLocalizedAccountName(item.code, item.name, locale)} amount={item.amount} currency={currency} base={pl.revenue.total} isAr={isAr} indent />
            ))}
            {pl.revenue.items.length === 0 && <EmptyRow label={isAr ? 'لا توجد حركات في حسابات الإيرادات' : isTr ? 'Hareket gören gelir hesabı yok' : 'No revenue accounts with activity'} />}
            <SubtotalRow label={isAr ? 'إجمالي الإيرادات' : isTr ? 'Toplam Gelir' : 'Total Revenue'} amount={pl.revenue.total} currency={currency} base={pl.revenue.total} color="var(--color-brand-500)" isAr={isAr} />

            {/* COGS */}
            <SectionHeader label={isAr ? 'تكلفة المبيعات والبضاعة المباعة' : isTr ? 'SATIŞLARIN MALİYETİ' : 'COST OF SALES'} />
            {pl.costOfSales.items.map((item) => (
              <AccountRow key={item.accountId} code={item.code} name={getLocalizedAccountName(item.code, item.name, locale)} amount={item.amount} currency={currency} base={pl.revenue.total} isAr={isAr} indent />
            ))}
            {pl.costOfSales.items.length === 0 && <EmptyRow label={isAr ? 'لا توجد حركات في حسابات تكلفة المبيعات' : isTr ? 'Hareket gören maliyet hesabı yok' : 'No COGS accounts with activity'} />}
            <SubtotalRow label={isAr ? 'إجمالي تكلفة المبيعات' : isTr ? 'Toplam Satış Maliyeti' : 'Total Cost of Sales'} amount={pl.costOfSales.total} currency={currency} base={pl.revenue.total} color="var(--color-warning)" isAr={isAr} />

            {/* Gross Profit */}
            <TotalRow label={isAr ? 'مجمل الربح' : isTr ? 'BRÜT KÂR' : 'GROSS PROFIT'} amount={pl.grossProfit} currency={currency} base={pl.revenue.total} positive={pl.grossProfit >= 0} isAr={isAr} />

            {/* Operating Expenses */}
            <SectionHeader label={isAr ? 'المصروفات التشغيلية والعمومية' : isTr ? 'FAALİYET GİDERLERİ' : 'OPERATING EXPENSES'} />
            {pl.operatingExpenses.items.map((item) => (
              <AccountRow key={item.accountId} code={item.code} name={getLocalizedAccountName(item.code, item.name, locale)} amount={item.amount} currency={currency} base={pl.revenue.total} isAr={isAr} indent />
            ))}
            {pl.operatingExpenses.items.length === 0 && <EmptyRow label={isAr ? 'لا توجد حركات في حسابات المصروفات التشغيلية' : isTr ? 'Hareket gören faaliyet gider hesabı yok' : 'No operating expense accounts with activity'} />}
            <SubtotalRow label={isAr ? 'إجمالي المصروفات التشغيلية' : isTr ? 'Toplam Faaliyet Giderleri' : 'Total Operating Expenses'} amount={pl.operatingExpenses.total} currency={currency} base={pl.revenue.total} color="var(--color-danger)" isAr={isAr} />

            {/* Operating Profit */}
            <TotalRow label={isAr ? 'الربح التشغيلي' : isTr ? 'FAALİYET KÂRI' : 'OPERATING PROFIT'} amount={pl.operatingProfit} currency={currency} base={pl.revenue.total} positive={pl.operatingProfit >= 0} isAr={isAr} />

            {/* Other Income */}
            {(pl.otherIncome.items.length > 0 || pl.otherExpenses.items.length > 0) && (
              <>
                <SectionHeader label={isAr ? 'الإيرادات والمصروفات الأخرى' : isTr ? 'DİĞER GELİR VE GİDERLER' : 'OTHER INCOME / EXPENSES'} />
                {pl.otherIncome.items.map((item) => (
                  <AccountRow key={item.accountId} code={item.code} name={getLocalizedAccountName(item.code, item.name, locale)} amount={item.amount} currency={currency} base={pl.revenue.total} isAr={isAr} indent />
                ))}
                {pl.otherExpenses.items.map((item) => (
                  <AccountRow key={item.accountId} code={item.code} name={`(${getLocalizedAccountName(item.code, item.name, locale)})`} amount={-item.amount} currency={currency} base={pl.revenue.total} isAr={isAr} indent />
                ))}
                <SubtotalRow
                  label={isAr ? 'صافي الإيرادات / (المصروفات) الأخرى' : isTr ? 'Net Diğer Gelir / (Gider)' : 'Net Other Income / (Expenses)'}
                  amount={pl.otherIncome.total - pl.otherExpenses.total}
                  currency={currency}
                  base={pl.revenue.total}
                  color="var(--color-info)"
                  isAr={isAr}
                />
              </>
            )}

            {/* Net Profit */}
            <tr style={{ background: pl.isProfit ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderTop: '2px solid var(--border-color)' }}>
              <td style={{ padding: '1rem 1.25rem', fontWeight: 800, fontSize: '0.9375rem', fontFamily: 'Outfit, sans-serif' }}>
                {pl.isProfit ? (isAr ? '📈 صافي الربح' : isTr ? '📈 NET KÂR' : '📈 NET PROFIT') : (isAr ? '📉 صافي الخسارة' : isTr ? '📉 NET ZARAR' : '📉 NET LOSS')}
              </td>
              <td style={{ padding: '1rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontWeight: 800, fontSize: '1.125rem', fontFamily: 'Outfit, sans-serif', color: pl.isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {fmt(pl.netProfit)}
              </td>
              <td style={{ padding: '1rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {pct(pl.netProfit, pl.revenue.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr style={{ background: 'var(--bg-page)' }}>
      <td colSpan={3} style={{ padding: '0.625rem 1.25rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </td>
    </tr>
  )
}

function AccountRow({ code, name, amount, currency, base, indent, isAr }: { code: string; name: string; amount: number; currency: string; base: number; indent?: boolean; isAr?: boolean }) {
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)
  const pct = base !== 0 ? `${((Math.abs(amount) / base) * 100).toFixed(1)}%` : '—'
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
      <td style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', [isAr ? 'paddingRight' : 'paddingLeft']: indent ? '2.5rem' : '1.25rem' }}>
        <span style={{ color: 'var(--text-muted)', [isAr ? 'marginLeft' : 'marginRight']: '0.5rem', fontSize: '0.75rem' }}>{code}</span>
        {name}
      </td>
      <td style={{ padding: '0.625rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 500 }}>{fmt(amount)}</td>
      <td style={{ padding: '0.625rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{pct}</td>
    </tr>
  )
}

function SubtotalRow({ label, amount, currency, base, color, isAr }: { label: string; amount: number; currency: string; base: number; color: string; isAr?: boolean }) {
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)
  const pct = base !== 0 ? `${((Math.abs(amount) / base) * 100).toFixed(1)}%` : '—'
  return (
    <tr style={{ borderTop: '1px solid var(--border-color)', borderBottom: '2px solid var(--border-color)', background: 'var(--bg-page)' }}>
      <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, color }}>{label}</td>
      <td style={{ padding: '0.75rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 700, color }}>{fmt(amount)}</td>
      <td style={{ padding: '0.75rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{pct}</td>
    </tr>
  )
}

function TotalRow({ label, amount, currency, base, positive, isAr }: { label: string; amount: number; currency: string; base: number; positive: boolean; isAr?: boolean }) {
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)
  const pct = base !== 0 ? `${((amount / base) * 100).toFixed(1)}%` : '—'
  return (
    <tr style={{ background: positive ? 'rgba(99,102,241,0.06)' : 'rgba(239,68,68,0.06)', borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)' }}>
      <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{label}</td>
      <td style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '1rem', fontWeight: 800, color: positive ? 'var(--color-brand-500)' : 'var(--color-danger)', fontFamily: 'Outfit, sans-serif' }}>{fmt(amount)}</td>
      <td style={{ padding: '0.875rem 1.25rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{pct}</td>
    </tr>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td colSpan={3} style={{ padding: '0.75rem 2.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{label}</td>
    </tr>
  )
}
