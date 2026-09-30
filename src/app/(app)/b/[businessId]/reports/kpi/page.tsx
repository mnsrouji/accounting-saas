import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, TrendingDown, DollarSign, Package,
  Users, Truck, Activity, PiggyBank, BarChart3, Percent,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Executive KPI Dashboard | AccountFlow',
  description: 'Key Performance Indicators — Financial ratios, margins, and business metrics',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ fromDate?: string; toDate?: string }>
}

export default async function KPIDashboardPage({ params, searchParams }: PageProps) {
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

  const kpi = await ReportingService.getKPIs(businessId, fromDate, toDate)
  const currency = kpi.currency
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtDays = (n: number) => isAr ? `${Math.round(n)} يوماً` : isTr ? `${Math.round(n)} gün` : `${Math.round(n)} days`
  const fmtX = (n: number) => `${n.toFixed(2)}x`

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
            <span>{isAr ? 'مؤشرات الأداء KPI' : isTr ? 'KPI Paneli' : 'KPI Dashboard'}</span>
          </div>
          <h1 className="page-title">
            {isAr ? 'لوحة مؤشرات الأداء الرئيسية التنفيذية (KPIs)' : isTr ? 'Yönetici KPI ve Performans Paneli' : 'Executive KPI Dashboard'}
          </h1>
          <p className="page-subtitle">{business.name} · {kpi.period}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" name="fromDate" defaultValue={fromDate.toISOString().split('T')[0]} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{isAr ? 'إلى' : isTr ? '-' : 'to'}</span>
            <input type="date" name="toDate" defaultValue={toDate.toISOString().split('T')[0]} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {isAr ? 'تطبيق' : isTr ? 'Uygula' : 'Apply'}
            </button>
          </form>
        </div>
      </div>

      {/* Profitability Section */}
      <SectionTitle title={isAr ? '📊 مؤشرات الربحية والأداء المالي' : isTr ? '📊 Kârlılık Oranları' : '📊 Profitability'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard
          label={isAr ? 'الإيرادات' : isTr ? 'Gelir' : 'Revenue'}
          value={fmt(kpi.revenue)}
          sub={`${kpi.salesCount} ${isAr ? 'فاتورة' : isTr ? 'fatura' : 'invoices'}`}
          icon={<DollarSign size={20} />}
          iconColor="var(--color-brand-500)"
          iconBg="rgba(99,102,241,0.12)"
        />
        <KPICard
          label={isAr ? 'مجمل الربح' : isTr ? 'Brüt Kâr' : 'Gross Profit'}
          value={fmt(kpi.grossProfit)}
          sub={`${isAr ? 'الهامش: ' : isTr ? 'Marj: ' : 'Margin: '}${fmtPct(kpi.grossMarginPct)}`}
          icon={<TrendingUp size={20} />}
          iconColor="var(--color-success)"
          iconBg="rgba(16,185,129,0.12)"
          highlight={kpi.grossProfit >= 0 ? 'success' : 'danger'}
        />
        <KPICard
          label={isAr ? 'الربح التشغيلي' : isTr ? 'Faaliyet Kârı' : 'Operating Profit'}
          value={fmt(kpi.operatingProfit)}
          sub={`${isAr ? 'بعد مصاريف تشغيل: ' : isTr ? 'Faaliyet gideri sonrası: ' : 'After opex of '}${fmt(kpi.operatingExpenses)}`}
          icon={<Activity size={20} />}
          iconColor="var(--color-info)"
          iconBg="rgba(59,130,246,0.12)"
          highlight={kpi.operatingProfit >= 0 ? 'success' : 'danger'}
        />
        <KPICard
          label={isAr ? 'صافي الربح' : isTr ? 'Net Kâr' : 'Net Profit'}
          value={fmt(kpi.netProfit)}
          sub={`${isAr ? 'هامش الصافي: ' : isTr ? 'Net marj: ' : 'Net margin: '}${fmtPct(kpi.netMarginPct)}`}
          icon={kpi.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          iconColor={kpi.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
          iconBg={kpi.netProfit >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
          highlight={kpi.netProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Margin Bars */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
          {isAr ? 'تحليل الهوامش الربحية والتكاليف' : isTr ? 'Marj Analizi' : 'Margin Analysis'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <MarginBar label={isAr ? 'هامش مجمل الربح' : isTr ? 'Brüt Kâr Marjı' : 'Gross Margin'} pct={kpi.grossMarginPct} color="var(--color-success)" />
          <MarginBar label={isAr ? 'هامش الربح التشغيلي' : isTr ? 'Faaliyet Kâr Marjı' : 'Operating Margin'} pct={(kpi.operatingProfit / (kpi.revenue || 1)) * 100} color="var(--color-info)" />
          <MarginBar label={isAr ? 'هامش صافي الربح' : isTr ? 'Net Kâr Marjı' : 'Net Margin'} pct={kpi.netMarginPct} color="var(--color-brand-500)" />
          <MarginBar label={isAr ? 'تكلفة المبيعات كنسبة من الإيراد' : isTr ? 'Satış Maliyeti Oranı' : 'COGS as % Revenue'} pct={(kpi.cogs / (kpi.revenue || 1)) * 100} color="var(--color-warning)" invert />
        </div>
      </div>

      {/* Liquidity & Working Capital */}
      <SectionTitle title={isAr ? '💧 مؤشرات السيولة ورأس المال العامل' : isTr ? '💧 Likidite ve İşletme Sermayesi' : '💧 Liquidity & Working Capital'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard
          label={isAr ? 'نسبة التداول (Current Ratio)' : isTr ? 'Cari Oran' : 'Current Ratio'}
          value={fmtX(kpi.currentRatio)}
          sub={kpi.currentRatio >= 2 ? (isAr ? '✅ ممتاز وقوي' : isTr ? '✅ Güçlü' : '✅ Healthy') : kpi.currentRatio >= 1 ? (isAr ? '⚠️ مقبول' : isTr ? '⚠️ Yeterli' : '⚠️ Adequate') : (isAr ? '🔴 أقل من 1.0 (عجز سيولة)' : '🔴 Below 1.0')}
          icon={<BarChart3 size={20} />}
          iconColor="var(--color-info)"
          iconBg="rgba(59,130,246,0.12)"
          highlight={kpi.currentRatio >= 1.5 ? 'success' : kpi.currentRatio >= 1 ? 'warning' : 'danger'}
        />
        <KPICard
          label={isAr ? 'نسبة السيولة السريعة (Quick Ratio)' : isTr ? 'Asit-Test Oranı' : 'Quick Ratio'}
          value={fmtX(kpi.quickRatio)}
          sub={kpi.quickRatio >= 1 ? (isAr ? '✅ جيدة جداً' : isTr ? '✅ İyi' : '✅ Good') : (isAr ? '⚠️ أقل من المعيار المستهدف' : '⚠️ Below benchmark')}
          icon={<Activity size={20} />}
          iconColor="#8b5cf6"
          iconBg="rgba(139,92,246,0.12)"
          highlight={kpi.quickRatio >= 1 ? 'success' : 'warning'}
        />
        <KPICard
          label={isAr ? 'الرصيد النقدي والبنكي' : isTr ? 'Nakit ve Banka Bakiyesi' : 'Cash Balance'}
          value={fmt(kpi.cashBalance)}
          sub={isAr ? 'الصناديق والحسابات البنكية' : isTr ? 'Kasa ve bankalar' : 'Cash & bank accounts'}
          icon={<PiggyBank size={20} />}
          iconColor="var(--color-success)"
          iconBg="rgba(16,185,129,0.12)"
        />
        <KPICard
          label={isAr ? 'إجمالي قيمة المخزون' : isTr ? 'Stok Değeri' : 'Inventory Value'}
          value={fmt(kpi.inventoryValue)}
          sub={isAr ? 'متوسط التكلفة المرجح WAC' : isTr ? 'Ağırlıklı ortalama maliyet' : 'Weighted average cost'}
          icon={<Package size={20} />}
          iconColor="var(--color-warning)"
          iconBg="rgba(245,158,11,0.12)"
        />
      </div>

      {/* Efficiency Ratios */}
      <SectionTitle title={isAr ? '⚙️ نسب ومؤشرات الكفاءة والتحصيل' : isTr ? '⚙️ Faaliyet ve Verimlilik Oranları' : '⚙️ Efficiency Ratios'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard
          label={isAr ? 'فترة تحصيل الذمم المدينة (DSO)' : isTr ? 'Alacak Tahsil Süresi (DSO)' : 'Days Sales Outstanding (DSO)'}
          value={fmtDays(kpi.dso)}
          sub={`${isAr ? 'ذمم العملاء: ' : isTr ? 'Alacaklar: ' : 'A/R: '}${fmt(kpi.receivables)}`}
          icon={<Users size={20} />}
          iconColor="var(--color-brand-500)"
          iconBg="rgba(99,102,241,0.12)"
          highlight={kpi.dso <= 30 ? 'success' : kpi.dso <= 60 ? 'warning' : 'danger'}
          sub2={kpi.dso <= 30 ? (isAr ? '✅ تحصيل ممتاز وسريع' : isTr ? '✅ Mükemmel' : '✅ Excellent') : kpi.dso <= 60 ? (isAr ? '⚠️ متوسط' : isTr ? '⚠️ Ortalama' : '⚠️ Average') : (isAr ? '🔴 متأخر — يجب تسريع التحصيل' : '🔴 High — collect faster')}
        />
        <KPICard
          label={isAr ? 'فترة سداد ذمم الموردين (DPO)' : isTr ? 'Borç Ödeme Süresi (DPO)' : 'Days Payable Outstanding (DPO)'}
          value={fmtDays(kpi.dpo)}
          sub={`${isAr ? 'ذمم الموردين: ' : isTr ? 'Borçlar: ' : 'A/P: '}${fmt(kpi.payables)}`}
          icon={<Truck size={20} />}
          iconColor="var(--color-danger)"
          iconBg="rgba(239,68,68,0.12)"
          sub2={kpi.dpo >= 30 ? (isAr ? '✅ شروط دفع وسداد جيدة' : isTr ? '✅ İyi ödeme vadesi' : '✅ Good payment terms') : (isAr ? '⚠️ سداد مبكر للسيولة' : '⚠️ Paying early')}
        />
        <KPICard
          label={isAr ? 'معدل دوران المخزون' : isTr ? 'Stok Devir Hızı' : 'Inventory Turnover'}
          value={fmtX(kpi.inventoryTurnover)}
          sub={isAr ? 'تكلفة المبيعات ÷ قيمة المخزون' : isTr ? 'Satış Maliyeti ÷ Stok Değeri' : 'COGS ÷ Inventory Value'}
          icon={<Package size={20} />}
          iconColor="#ec4899"
          iconBg="rgba(236,72,153,0.12)"
          highlight={kpi.inventoryTurnover >= 4 ? 'success' : kpi.inventoryTurnover >= 2 ? 'warning' : 'danger'}
          sub2={kpi.inventoryTurnover >= 4 ? (isAr ? '✅ دوران سريع وقوي' : isTr ? '✅ Hızlı Devir' : '✅ Strong') : kpi.inventoryTurnover >= 2 ? (isAr ? '⚠️ متوسط' : isTr ? '⚠️ Orta' : '⚠️ Moderate') : (isAr ? '🔴 بطيء — مخزون راكد' : '🔴 Low — excess inventory')}
        />
      </div>

      {/* Activity Summary */}
      <SectionTitle title={isAr ? '📋 ملخص النشاط وحجم العمليات' : isTr ? '📋 Faaliyet Özeti' : '📋 Activity Summary'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard label={isAr ? 'فواتير المبيعات' : isTr ? 'Satış Faturaları' : 'Sales Invoices'} value={kpi.salesCount.toString()} sub={isAr ? 'حركات الفترة' : isTr ? 'Dönem işlemleri' : 'Period transactions'} icon={<DollarSign size={20} />} iconColor="var(--color-brand-500)" iconBg="rgba(99,102,241,0.12)" />
        <KPICard label={isAr ? 'فواتير المشتريات' : isTr ? 'Alış Faturaları' : 'Purchase Bills'} value={kpi.purchaseCount.toString()} sub={isAr ? 'حركات الفترة' : isTr ? 'Dönem işlemleri' : 'Period transactions'} icon={<Package size={20} />} iconColor="var(--color-warning)" iconBg="rgba(245,158,11,0.12)" />
        <KPICard label={isAr ? 'متوسط قيمة الفاتورة' : isTr ? 'Ortalama Fatura Değeri' : 'Avg Invoice Value'} value={fmt(kpi.salesCount > 0 ? kpi.revenue / kpi.salesCount : 0)} sub={isAr ? 'لكل فاتورة مبيعات' : isTr ? 'Satış faturası başına' : 'Per sales invoice'} icon={<Percent size={20} />} iconColor="var(--color-success)" iconBg="rgba(16,185,129,0.12)" />
        <KPICard label={isAr ? 'متوسط قيمة الشراء' : isTr ? 'Ortalama Alış Değeri' : 'Avg Purchase Value'} value={fmt(kpi.purchaseCount > 0 ? kpi.cogs / kpi.purchaseCount : 0)} sub={isAr ? 'لكل فاتورة شراء' : isTr ? 'Alış faturası başına' : 'Per purchase bill'} icon={<Percent size={20} />} iconColor="var(--color-danger)" iconBg="rgba(239,68,68,0.12)" />
      </div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.875rem', marginTop: '0.5rem' }}>
      {title}
    </h2>
  )
}

function KPICard({
  label, value, sub, sub2, icon, iconColor, iconBg, highlight,
}: {
  label: string
  value: string
  sub?: string
  sub2?: string
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  highlight?: 'success' | 'warning' | 'danger'
}) {
  const borderColor = highlight === 'success' ? 'var(--color-success)'
    : highlight === 'warning' ? 'var(--color-warning)'
    : highlight === 'danger' ? 'var(--color-danger)'
    : 'transparent'

  return (
    <div className="card" style={{ padding: '1.25rem', borderTop: highlight ? `3px solid ${borderColor}` : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>}
      {sub2 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub2}</div>}
    </div>
  )
}

function MarginBar({ label, pct, color, invert }: { label: string; pct: number; color: string; invert?: boolean }) {
  const displayPct = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: invert ? 'var(--color-warning)' : color }}>
          {displayPct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-page)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${displayPct}%`,
          background: color,
          transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  )
}
