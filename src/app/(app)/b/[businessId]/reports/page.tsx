import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Scale, Droplets, Clock, BarChart3,
  ArrowUpRight, ArrowDownRight, Package, DollarSign, FileSpreadsheet,
  ChevronRight, Activity,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Financial Reports | AccountFlow',
  description: 'Financial reporting hub — P&L, Balance Sheet, Cash Flow, Aging, and Business Intelligence',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function ReportsHubPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const { business } = await requireBusinessAccess(businessId)
  const currency = business.defaultCurrency
  const fmt = (n: number) => formatCurrency(n.toFixed(2), currency)

  // Fetch quick KPIs for the hub — YTD
  const now = new Date()
  const ytdFrom = new Date(now.getFullYear(), 0, 1)

  const kpi = await ReportingService.getKPIs(businessId, ytdFrom, now).catch(() => null)
  const [ar, ap] = await Promise.all([
    ReportingService.getARAgingSummary(businessId, now).catch(() => null),
    ReportingService.getAPAgingSummary(businessId, now).catch(() => null),
  ])

  // Localized dictionary for reports hub
  const t = {
    pageTitle:
      locale === 'ar' ? 'التقارير والقوائم المالية' : locale === 'tr' ? 'Mali Tablolar ve Raporlar' : 'Financial Reports',
    pageSubtitle:
      locale === 'ar'
        ? `القوائم المالية والتحليلات الذكية ومؤشرات الأداء لمنشأة ${business.name}`
        : locale === 'tr'
        ? `${business.name} için kapsamlı mali tablolar ve iş zekası raporları`
        : `Comprehensive financial statements and business intelligence for ${business.name}`,
    financialSection:
      locale === 'ar'
        ? 'القوائم المالية والتحليلات الذكية'
        : locale === 'tr'
        ? 'Mali Tablolar ve İş Zekası'
        : 'Financial Statements & Business Intelligence',
    operationalSection:
      locale === 'ar'
        ? 'سجلات المعاملات والتقارير التفصيلية'
        : locale === 'tr'
        ? 'İşlem Defterleri ve Detaylı Raporlar'
        : 'Operational Transaction Reports',
    kpis: {
      revenue: locale === 'ar' ? 'إيرادات السنة (YTD)' : locale === 'tr' ? 'Yıllık Gelir (YTD)' : 'YTD Revenue',
      margin: locale === 'ar' ? 'هامش الربح الإجمالي' : locale === 'tr' ? 'Brüt Kâr Marjı' : 'Gross Margin',
      netProfit: locale === 'ar' ? 'صافي الأرباح' : locale === 'tr' ? 'Net Kâr' : 'Net Profit',
      ar: locale === 'ar' ? 'مستحقات العملاء (AR)' : locale === 'tr' ? 'Müşteri Alacakları (AR)' : 'A/R Outstanding',
      ap: locale === 'ar' ? 'مستحقات الموردين (AP)' : locale === 'tr' ? 'Tedarikçi Borçları (AP)' : 'A/P Outstanding',
    },
    pl: {
      title: locale === 'ar' ? 'الأرباح والخسائر' : locale === 'tr' ? 'Gelir Tablosu' : 'Profit & Loss',
      subtitle: locale === 'ar' ? 'قائمة الدخل الشامل (P&L)' : locale === 'tr' ? 'Kâr ve Zarar Tablosu' : 'Income Statement',
      desc:
        locale === 'ar'
          ? 'الإيرادات، تكلفة المبيعات، مجمل الربح، المصروفات التشغيلية، وصافي الدخل حسب الفترات.'
          : locale === 'tr'
          ? 'Dönemsel gelirler, satışların maliyeti, brüt kâr, faaliyet giderleri ve net dönem kârı.'
          : 'Revenue, cost of sales, gross profit, operating expenses, and net income by period.',
      badgeLabel: locale === 'ar' ? 'صافي السنة' : locale === 'tr' ? 'Yıllık Net' : 'YTD Net',
    },
    bs: {
      title: locale === 'ar' ? 'الميزانية العمومية' : locale === 'tr' ? 'Bilanço' : 'Balance Sheet',
      subtitle: locale === 'ar' ? 'قائمة المركز المالي' : locale === 'tr' ? 'Finansal Durum Tablosu' : 'Statement of Financial Position',
      desc:
        locale === 'ar'
          ? 'الأصول، الالتزامات، وحقوق الملكية في أي تاريخ محدد مع التحقق التلقائي من توازن الميزانية.'
          : locale === 'tr'
          ? 'Varlıklar, yabancı kaynaklar ve özkaynaklar. Otomatik denklik kontrolü (Aktif = Pasif).'
          : 'Assets, liabilities, and equity as of any date. Auto-validates Assets = Liabilities + Equity.',
    },
    cf: {
      title: locale === 'ar' ? 'قائمة التدفقات النقدية' : locale === 'tr' ? 'Nakit Akış Tablosu' : 'Cash Flow Statement',
      subtitle: locale === 'ar' ? 'الطريقة غير المباشرة' : locale === 'tr' ? 'Dolaylı Yöntem' : 'Indirect Method',
      desc:
        locale === 'ar'
          ? 'التدفقات النقدية من الأنشطة التشغيلية، الاستثمارية، والتمويلية مع مطابقة رصيد أول وآخر المدة.'
          : locale === 'tr'
          ? 'İşletme, yatırım ve finansman faaliyetlerinden nakit akışları ve kasa/banka mutabakatı.'
          : 'Operating, investing, and financing cash flows with opening and closing cash reconciliation.',
    },
    aging: {
      title: locale === 'ar' ? 'أعمار الديون (AR / AP)' : locale === 'tr' ? 'Borç ve Alacak Yaşlandırma' : 'AR & AP Aging',
      subtitle: locale === 'ar' ? 'تحليل مستحقات العملاء والموردين' : locale === 'tr' ? 'Vade ve Risk Analizi' : 'Receivables & Payables Analysis',
      desc:
        locale === 'ar'
          ? 'تحليل الفواتير المستحقة والمتأخرة ومجموعات الفترات (حالي، 30، 60، 90+ يوماً).'
          : locale === 'tr'
          ? 'Vadesi geçmiş ve açık faturaların yaşlandırma analizi (Cari, 30, 60, 90+ gün).'
          : 'Age analysis of outstanding invoices and bills with bucket breakdown (Current, 30, 60, 90+ days).',
      badgeLabel: locale === 'ar' ? 'مستحقات معلقة' : locale === 'tr' ? 'Açık Alacaklar' : 'A/R Outstanding',
    },
    kpiCard: {
      title: locale === 'ar' ? 'مؤشرات الأداء التنفيذية' : locale === 'tr' ? 'Yönetici KPI Paneli' : 'Executive KPI Dashboard',
      subtitle: locale === 'ar' ? 'ذكاء الأعمال والتحليل المالي' : locale === 'tr' ? 'İş Zekası ve Analitik' : 'Business Intelligence',
      desc:
        locale === 'ar'
          ? 'هامش الربح، معدل دوران المخزون، أيام التحصيل، نسبة السيولة، وأكثر من 12 مؤشراً حيوياً.'
          : locale === 'tr'
          ? 'Brüt kâr marjı, stok devir hızı, tahsilat süresi, cari oran ve 12+ temel finansal gösterge.'
          : 'Gross margin, net margin, DSO, DPO, current ratio, inventory turnover, and 12+ KPIs.',
      badgeLabel: locale === 'ar' ? 'هامش الربح' : locale === 'tr' ? 'Brüt Marj' : 'Gross Margin',
    },
    analytics: {
      title: locale === 'ar' ? 'تحليلات المبيعات والمصروفات' : locale === 'tr' ? 'Satış ve Gider Analitiği' : 'Business Analytics',
      subtitle: locale === 'ar' ? 'المبيعات، المصروفات والمخزون' : locale === 'tr' ? 'Satış, Harcama ve Stok' : 'Sales, Expense & Inventory',
      desc:
        locale === 'ar'
          ? 'الاتجاهات الشهرية، كبار العملاء، أكثر المنتجات مبيعاً، وتوزيع المصروفات وتقييم المخزون.'
          : locale === 'tr'
          ? 'Aylık eğilimler, en çok satan ürünler, ana müşteriler ve gider dağılım analizi.'
          : 'Monthly trends, top customers, top products, expense breakdown by category, and inventory valuation.',
    },
  }

  const reports = [
    {
      id: 'pl',
      href: `/b/${businessId}/reports/pl`,
      title: t.pl.title,
      subtitle: t.pl.subtitle,
      description: t.pl.desc,
      icon: <TrendingUp size={28} />,
      iconBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      badge: kpi ? (kpi.netProfit >= 0 ? `+${fmt(kpi.netProfit)}` : fmt(kpi.netProfit)) : null,
      badgeColor: kpi && kpi.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
      badgeBg: kpi && kpi.netProfit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      badgeLabel: t.pl.badgeLabel,
    },
    {
      id: 'balance-sheet',
      href: `/b/${businessId}/reports/balance-sheet`,
      title: t.bs.title,
      subtitle: t.bs.subtitle,
      description: t.bs.desc,
      icon: <Scale size={28} />,
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      badge: null,
      badgeColor: null,
      badgeBg: null,
      badgeLabel: null,
    },
    {
      id: 'cash-flow',
      href: `/b/${businessId}/reports/cash-flow`,
      title: t.cf.title,
      subtitle: t.cf.subtitle,
      description: t.cf.desc,
      icon: <Droplets size={28} />,
      iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      badge: null,
      badgeColor: null,
      badgeBg: null,
      badgeLabel: null,
    },
    {
      id: 'aging',
      href: `/b/${businessId}/reports/aging`,
      title: t.aging.title,
      subtitle: t.aging.subtitle,
      description: t.aging.desc,
      icon: <Clock size={28} />,
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      badge: ar ? fmt(ar.buckets.total) : null,
      badgeColor: 'var(--color-danger)',
      badgeBg: 'rgba(239,68,68,0.1)',
      badgeLabel: t.aging.badgeLabel,
    },
    {
      id: 'kpi',
      href: `/b/${businessId}/reports/kpi`,
      title: t.kpiCard.title,
      subtitle: t.kpiCard.subtitle,
      description: t.kpiCard.desc,
      icon: <Activity size={28} />,
      iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      badge: kpi ? `${kpi.grossMarginPct.toFixed(1)}%` : null,
      badgeColor: 'var(--color-brand-500)',
      badgeBg: 'rgba(99,102,241,0.1)',
      badgeLabel: t.kpiCard.badgeLabel,
    },
    {
      id: 'analytics',
      href: `/b/${businessId}/reports/analytics`,
      title: t.analytics.title,
      subtitle: t.analytics.subtitle,
      description: t.analytics.desc,
      icon: <BarChart3 size={28} />,
      iconBg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      badge: null,
      badgeColor: null,
      badgeBg: null,
      badgeLabel: null,
    },
  ]

  // Legacy operational reports
  const operationalReports = [
    {
      id: 'sales',
      label: locale === 'ar' ? 'سجل فواتير المبيعات' : locale === 'tr' ? 'Satış Defteri' : 'Sales Register',
      icon: <DollarSign size={16} />,
      href: `/b/${businessId}/reports?tab=sales`,
    },
    {
      id: 'purchases',
      label: locale === 'ar' ? 'سجل فواتير المشتريات' : locale === 'tr' ? 'Alış Defteri' : 'Purchase Register',
      icon: <Package size={16} />,
      href: `/b/${businessId}/reports?tab=purchases`,
    },
    {
      id: 'ar',
      label: locale === 'ar' ? 'أستاذ مساعد العملاء (AR)' : locale === 'tr' ? 'Müşteri Muavini (AR)' : 'A/R Ledger',
      icon: <ArrowUpRight size={16} />,
      href: `/b/${businessId}/reports?tab=ar`,
    },
    {
      id: 'ap',
      label: locale === 'ar' ? 'أستاذ مساعد الموردين (AP)' : locale === 'tr' ? 'Tedarikçi Muavini (AP)' : 'A/P Ledger',
      icon: <ArrowDownRight size={16} />,
      href: `/b/${businessId}/reports?tab=ap`,
    },
    {
      id: 'expenses',
      label: locale === 'ar' ? 'تقرير المصروفات التفصيلي' : locale === 'tr' ? 'Gider Raporu' : 'Expense Report',
      icon: <FileSpreadsheet size={16} />,
      href: `/b/${businessId}/reports?tab=expenses`,
    },
    {
      id: 'inventory',
      label: locale === 'ar' ? 'تقرير حركة وجرد المخزون' : locale === 'tr' ? 'Stok Envanter Raporu' : 'Inventory Report',
      icon: <Package size={16} />,
      href: `/b/${businessId}/reports?tab=inventory`,
    },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title">{t.pageTitle}</h1>
        <p className="page-subtitle">{t.pageSubtitle}</p>
      </div>

      {/* Quick KPI Strip */}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
          {[
            { label: t.kpis.revenue, value: fmt(kpi.revenue), color: 'var(--color-brand-500)', icon: <DollarSign size={16} /> },
            { label: t.kpis.margin, value: `${kpi.grossMarginPct.toFixed(1)}%`, color: 'var(--color-success)', icon: <TrendingUp size={16} /> },
            { label: t.kpis.netProfit, value: fmt(kpi.netProfit), color: kpi.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', icon: kpi.netProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} /> },
            { label: t.kpis.ar, value: ar ? fmt(ar.buckets.total) : '—', color: 'var(--color-danger)', icon: <ArrowUpRight size={16} /> },
            { label: t.kpis.ap, value: ap ? fmt(ap.buckets.total) : '—', color: 'var(--color-warning)', icon: <ArrowDownRight size={16} /> },
          ].map((item, i) => (
            <div key={i} className="card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                <span style={{ color: item.color }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Financial Statement Reports */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        {t.financialSection}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {reports.map((report) => (
          <Link
            key={report.id}
            href={report.href}
            id={`report-${report.id}-card`}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: report.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', flexShrink: 0,
                }}>
                  {report.icon}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem', fontFamily: 'Outfit, sans-serif' }}>
                  {report.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.625rem', fontWeight: 600 }}>
                  {report.subtitle}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {report.description}
                </div>
              </div>

              {/* KPI Badge */}
              {report.badge && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    background: report.badgeBg!,
                    color: report.badgeColor!,
                  }}>
                    {report.badge}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{report.badgeLabel}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Operational Reports */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        {t.operationalSection}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {operationalReports.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            id={`op-report-${r.id}`}
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 150ms ease',
            }}
          >
            <span style={{ color: 'var(--color-brand-500)' }}>{r.icon}</span>
            <span style={{ flex: 1 }}>{r.label}</span>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          </Link>
        ))}
      </div>
    </div>
  )
}
