// =============================================================
// Usage & Capacity Center — Tenant Resource Dashboard
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { UsageService } from '@/lib/services/usage-service'
import { EntitlementService } from '@/lib/services/entitlement-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Zap,
  Users,
  Building2,
  FileText,
  Package,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Usage & Capacity Center | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function UsageCapacityPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const [usage, entitlements] = await Promise.all([
    UsageService.getTenantUsageSummary(businessId),
    EntitlementService.getEntitlements(businessId),
  ])

  const t = {
    title: isAr ? 'مركز الاستخدام والسعة' : isTr ? 'Kullanım ve Kapasite Merkezi' : 'Usage & Capacity Center',
    subtitle: isAr
      ? 'متابعة استهلاك الموارد لحظياً، كوتات الباقة، ومميزات الاشتراك المفعلة'
      : isTr
      ? 'Gerçek zamanlı kaynak kullanımını, paket kotalarını ve aktif özellikleri izleyin'
      : 'Monitor real-time resource utilization, plan quotas, and feature entitlements',
    manageSub: isAr ? 'إدارة باقة الاشتراك' : isTr ? 'Aboneliği Yönet' : 'Manage Subscription',
    planName: (p: string) => (isAr ? `باقة ${p}` : isTr ? `${p} Paketi` : `${p} Plan`),
    trialBadge: (days: number) =>
      isAr ? `تجريبية (متبقي ${days} يوم)` : isTr ? `Deneme (${days} gün kaldı)` : `Trial (${days} days remaining)`,
    activeSubBadge: isAr ? 'اشتراك نشط' : isTr ? 'Aktif Abonelik' : 'Active Subscription',
    bannerDesc: isAr
      ? 'تطبيق سقف الموارد الفعلي وحدود الباقة الآلية'
      : isTr
      ? 'Yetkili kota uygulaması ve otomatik paket limitleri'
      : 'Authoritative quota enforcement & automated tier limits',
    exceededAlert: isAr
      ? 'تم بلوغ الحد الأقصى للموارد — يلزم الترقية'
      : isTr
      ? 'Kaynak limitine ulaşıldı — Yükseltme gerekli'
      : 'Resource limit reached — Upgrade required',
    quotasTitle: isAr ? 'كوتات وسعة الموارد' : isTr ? 'Kaynak Kotaları ve Kullanımı' : 'Resource Quotas & Utilization',
    featuresTitle: isAr ? 'المميزات المضمنة في الباقة' : isTr ? 'Pakete Dahil Özellikler' : 'Included Plan Features',
    status: {
      exceeded: isAr ? 'تجاوزت الحد' : isTr ? 'Aşıldı' : 'Exceeded',
      warning: isAr ? 'قارب على الاكتمال' : isTr ? 'Sınıra Yaklaşıyor' : 'Approaching Limit',
      healthy: isAr ? 'طبيعي' : isTr ? 'Sağlıklı' : 'Healthy',
    },
    unlimited: isAr ? 'غير محدود' : isTr ? 'Sınırsız' : 'Unlimited',
    metricLabels: {
      users: isAr ? 'أعضاء الفريق' : isTr ? 'Ekip Üyeleri' : 'Team Members',
      monthlyInvoices: isAr ? 'فواتير المبيعات الشهرية' : isTr ? 'Aylık Satış Faturaları' : 'Monthly Sales Invoices',
      products: isAr ? 'أصناف المخزون' : isTr ? 'Stok Ürünleri' : 'Active Products',
      warehouses: isAr ? 'المستودعات' : isTr ? 'Depolar' : 'Warehouses',
      storageMb: isAr ? 'المساحة التخزينية (ميجابايت)' : isTr ? 'Depolama Alanı (MB)' : 'Storage (MB)',
    },
    metricDescs: {
      users: isAr ? 'أعضاء الفريق النشطون ذوو الصلاحيات' : isTr ? 'Sistem erişimi olan aktif ekip üyeleri' : 'Active team members with system access',
      monthlyInvoices: isAr ? 'فواتير المبيعات المصدرة خلال الشهر الحالي' : isTr ? 'Bu ay kesilen satış siparişleri ve faturaları' : 'Sales orders & invoices issued this calendar month',
      products: isAr ? 'الأصناف والمنتجات النشطة في الكتالوج' : isTr ? 'Aktif envanter ve ürün kalemleri' : 'Active inventory catalog items & SKUs',
      warehouses: isAr ? 'مستودعات ومواقع التخزين النشطة' : isTr ? 'Aktif stok tutma ve karşılama merkezleri' : 'Active stock holding & fulfillment locations',
      storageMb: isAr ? 'مرفقات المستندات وقاعدة البيانات المستخدمة' : isTr ? 'Ekli belgeler ve veritabanı alanı' : 'Attachment documents & database storage allocated',
    },
    featureNames: {
      multi_currency: isAr ? 'تعدد العملات والصرف' : isTr ? 'Çoklu Para Birimi' : 'Multi Currency',
      inventory_tracking: isAr ? 'تتبع المخزون والمستودعات' : isTr ? 'Stok ve Depo Takibi' : 'Inventory Tracking',
      treasury_management: isAr ? 'إدارة الخزينة والمصارف' : isTr ? 'Kasa ve Banka Yönetimi' : 'Treasury Management',
      bank_reconciliation: isAr ? 'المطابقة والتسوية البنكية' : isTr ? 'Banka Mutabakatı' : 'Bank Reconciliation',
      custom_roles: isAr ? 'أدوار وصلاحيات مخصصة' : isTr ? 'Özel Rol ve Yetkiler' : 'Custom Roles',
      audit_logging: isAr ? 'سجل التدقيق الأمني الشامل' : isTr ? 'Ayrıntılı Denetim İzi' : 'Audit Logging',
      api_access: isAr ? 'واجهة برمجية API' : isTr ? 'API Erişimi' : 'API Access',
      advanced_reports: isAr ? 'التقارير المالية المتقدمة' : isTr ? 'Gelişmiş Mali Raporlar' : 'Advanced Reports',
      period_closing: isAr ? 'إقفال الفترات المحاسبية' : isTr ? 'Dönem Sonu Kapanışı' : 'Period Closing',
    } as Record<string, string>,
  }

  const metricsList = [
    {
      key: 'users',
      metric: usage.metrics.users,
      label: t.metricLabels.users,
      icon: Users,
      color: '#3b82f6',
      desc: t.metricDescs.users,
    },
    {
      key: 'monthlyInvoices',
      metric: usage.metrics.monthlyInvoices,
      label: t.metricLabels.monthlyInvoices,
      icon: FileText,
      color: '#10b981',
      desc: t.metricDescs.monthlyInvoices,
    },
    {
      key: 'products',
      metric: usage.metrics.products,
      label: t.metricLabels.products,
      icon: Package,
      color: '#f59e0b',
      desc: t.metricDescs.products,
    },
    {
      key: 'warehouses',
      metric: usage.metrics.warehouses,
      label: t.metricLabels.warehouses,
      icon: Building2,
      color: '#8b5cf6',
      desc: t.metricDescs.warehouses,
    },
    {
      key: 'storageMb',
      metric: usage.metrics.storageMb,
      label: t.metricLabels.storageMb,
      icon: HardDrive,
      color: '#ec4899',
      desc: t.metricDescs.storageMb,
    },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <Link
          href={`/b/${businessId}/settings/subscription`}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', fontWeight: 600 }}
        >
          <CreditCard size={16} />
          <span>{t.manageSub}</span>
        </Link>
      </div>

      <SettingsNav businessId={businessId} />

      {/* Plan Summary Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(124, 58, 237, 0.03))',
          border: '1px solid rgba(79, 70, 229, 0.25)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Zap size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {t.planName(usage.planName)}
              </h2>
              {entitlements.isTrial ? (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {t.trialBadge(entitlements.daysRemainingInTrial || 0)}
                </span>
              ) : (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {t.activeSubBadge}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0 }}>
              {t.bannerDesc}
            </p>
          </div>
        </div>

        {usage.hasExceeded && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <AlertTriangle size={18} />
            <span>{t.exceededAlert}</span>
          </div>
        )}
      </div>

      {/* Quota Cards Grid */}
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t.quotasTitle}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        {metricsList.map(({ key, metric, label, icon: Icon, color, desc }) => {
          const isOver = metric.isExceeded
          const isWarn = metric.isWarning && !isOver

          return (
            <div
              key={key}
              className="card"
              style={{
                background: 'var(--bg-surface, #ffffff)',
                border: isOver
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : isWarn
                  ? '1px solid rgba(245, 158, 11, 0.4)'
                  : '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '1.25rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '8px',
                      background: `${color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: color,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {label}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>{desc}</p>
                  </div>
                </div>

                {isOver ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {t.status.exceeded}
                  </span>
                ) : isWarn ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#f59e0b',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {t.status.warning}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {t.status.healthy}
                  </span>
                )}
              </div>

              {/* Progress Numbers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {metric.current.toLocaleString()}
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 4px' }}>
                    / {metric.limit !== null ? metric.limit.toLocaleString() : t.unlimited}
                  </span>
                </div>
                {metric.limit !== null && (
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isOver ? '#ef4444' : isWarn ? '#f59e0b' : 'var(--text-secondary)' }}>
                    {metric.percent}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {metric.limit !== null && (
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: 'var(--bg-muted, #f1f5f9)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, metric.percent)}%`,
                      height: '100%',
                      borderRadius: '4px',
                      background: isOver ? '#ef4444' : isWarn ? '#f59e0b' : color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature Entitlements Checklist */}
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t.featuresTitle}
      </h3>

      <div
        className="card"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '14px',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {Object.entries(entitlements.features).map(([feat, isAllowed]) => {
            const label = t.featureNames[feat] || feat.replace(/_/g, ' ')
            return (
              <div
                key={feat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: isAllowed ? 'transparent' : 'var(--bg-muted, #f8fafc)',
                  opacity: isAllowed ? 1 : 0.6,
                }}
              >
                {isAllowed ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #94a3b8' }} />
                )}
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
