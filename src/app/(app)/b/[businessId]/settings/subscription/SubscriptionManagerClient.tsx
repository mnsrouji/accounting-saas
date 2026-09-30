// =============================================================
// Subscription Manager Client — Tenant Plan & Usage View
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

'use client'

import { useState, useTransition } from 'react'
import { changeSubscriptionPlanAction, cancelSubscriptionAction } from '@/actions/saas/subscription-actions'
import { useLocale } from 'next-intl'
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  Shield,
  Layers,
  Users,
  Building,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react'

export interface SubscriptionManagerProps {
  businessId: string
  subscription: {
    status: string
    isTrial: boolean
    daysRemainingInTrial?: number
    plan: {
      id: string
      name: string
      code: string
      price: number
      billingInterval: string
      maxUsers: number
      maxInvoicesPerMonth: number
      features: Record<string, boolean>
    }
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
  }
  usage: {
    metrics: Record<string, { label: string; current: number; limit: number | null; percent: number; isWarning: boolean; isExceeded: boolean }>
  }
  availablePlans: Array<{
    id: string
    name: string
    code: string
    description: string | null
    price: number
    billingInterval: string
    maxUsers: number
    maxInvoicesPerMonth: number
    features: any
  }>
}

export default function SubscriptionManagerClient({
  businessId,
  subscription,
  usage,
  availablePlans,
}: SubscriptionManagerProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [currentSub, setCurrentSub] = useState(subscription)
  const [isPending, startTransition] = useTransition()

  const t = {
    planTitle: (name: string) => (isAr ? `باقة ${name}` : isTr ? `${name} Paketi` : `${name} Plan`),
    currentBadge: isAr ? 'الخطة الحالية' : isTr ? 'MEVCUT PAKET' : 'CURRENT',
    activeStatus: isAr ? 'نشط' : isTr ? 'Aktif' : 'Active',
    trialText: (days: number) =>
      isAr
        ? `فترة تجريبية مجانية · متبقي ${days} يوماً قبل بدء الفوترة الفعلية.`
        : isTr
        ? `Ücretsiz Deneme · Faturalandırma başlamadan önce ${days} gün kaldı.`
        : `Free Trial · ${days} days remaining before billing begins.`,
    renewsText: (price: number, interval: string, date: string) =>
      isAr
        ? `$${price} / ${interval === 'month' ? 'شهرياً' : 'سنوياً'} · يتجدد في ${date}`
        : isTr
        ? `$${price} / ${interval === 'month' ? 'aylık' : 'yıllık'} · Yenilenme Tarihi: ${date}`
        : `$${price} / ${interval} · Renews on ${date}`,
    cancelRenewal: isAr ? 'إلغاء التجديد التلقائي' : isTr ? 'Yenilemeyi İptal Et' : 'Cancel Renewal',
    confirmCancel: isAr
      ? 'هل أنت متأكد من رغبتك في إلغاء تجديد الاشتراك عند نهاية الفترة الحالية؟'
      : isTr
      ? 'Fatura dönemi sonunda aboneliği iptal etmek istediğinize emin misiniz?'
      : 'Are you sure you want to cancel your subscription at the end of the billing period?',
    quotasTitle: isAr ? 'سعة الموارد ومؤشرات الاستهلاك المباشر' : isTr ? 'Paket Kaynak Kotaları ve Canlı Kullanım' : 'Plan Resource Quotas & Live Usage',
    availablePlansTitle: isAr ? 'الترقية وتغيير باقة الاشتراك' : isTr ? 'Paketi Yükselt veya Değiştir' : 'Upgrade or Change Subscription Plan',
    quotaExceeded: isAr ? 'تجاوزت الحد' : isTr ? 'Kota Aşıldı' : 'Quota Exceeded',
    quotaWarning: isAr ? 'قارب على الاكتمال' : isTr ? 'Sınıra Yaklaşıyor' : 'Approaching Limit',
    withinLimits: isAr ? 'ضمن الحدود' : isTr ? 'Limitler Dahilinde' : 'Within Limits',
    unlimited: isAr ? 'غير محدود' : isTr ? 'Sınırsız' : 'Unlimited',
    used: isAr ? 'مستخدم' : isTr ? 'kullanıldı' : 'used',
    perMonth: isAr ? '/ شهرياً' : isTr ? '/ ay' : '/ month',
    switchPlan: (name: string) => (isAr ? `الترقية إلى ${name}` : isTr ? `${name} Paketine Geç` : `Switch to ${name}`),
    currentPlanBtn: isAr ? 'باقتك الحالية' : isTr ? 'Mevcut Paketiniz' : 'Current Plan',
    teamUsers: (n: number) => (isAr ? `حتى ${n} مستخدمين للفريق` : isTr ? `${n} kullanıcıya kadar` : `Up to ${n} team users`),
    invoicesLimit: (n: number) => (isAr ? `حتى ${n} فاتورة مبيعات شهرياً` : isTr ? `Ayda ${n} satış faturasına kadar` : `Up to ${n} sales invoices/mo`),
    featuresIncluded: isAr ? 'تعدد المستودعات والخزينة مفعل' : isTr ? 'Çoklu depo ve kasa yönetimi dahil' : 'Multi-warehouse & Treasury enabled',
  }

  function handleUpgrade(planCode: string) {
    startTransition(async () => {
      const res = await changeSubscriptionPlanAction(businessId, planCode, 'month')
      if (res.success && res.data) {
        setCurrentSub(res.data as any)
        alert(isAr ? `تم تحديث خطة الاشتراك إلى ${res.data.plan.name} بنجاح!` : `Successfully updated subscription to ${res.data.plan.name}!`)
      } else {
        alert(res.error || (isAr ? 'فشل تحديث الخطة' : 'Failed to update plan'))
      }
    })
  }

  function handleCancel() {
    if (!confirm(t.confirmCancel)) return

    startTransition(async () => {
      const res = await cancelSubscriptionAction(businessId, false)
      if (res.success && res.data) {
        setCurrentSub(res.data as any)
        alert(isAr ? 'تم جدولة إلغاء الاشتراك عند نهاية الفترة.' : 'Subscription scheduled for cancellation at end of period.')
      } else {
        alert(res.error || (isAr ? 'فشل إلغاء الاشتراك' : 'Failed to cancel subscription'))
      }
    })
  }

  const { plan } = currentSub

  return (
    <div>
      {/* Current Plan Overview Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(99, 102, 241, 0.02))',
          border: '1px solid rgba(79, 70, 229, 0.25)',
          borderRadius: '16px',
          padding: '1.75rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(79, 70, 229, 0.12)',
                color: 'var(--color-brand-500, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {t.planTitle(plan.name)}
            </h2>
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: currentSub.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: currentSub.status === 'active' ? '#10b981' : '#f59e0b',
                border: currentSub.status === 'active' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              {currentSub.status === 'active' ? t.activeStatus : currentSub.status}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            {currentSub.isTrial
              ? t.trialText(currentSub.daysRemainingInTrial || 0)
              : t.renewsText(
                  Number(plan.price),
                  plan.billingInterval,
                  new Date(currentSub.currentPeriodEnd).toLocaleDateString(isAr ? 'ar-SA' : isTr ? 'tr-TR' : 'en-US')
                )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!currentSub.cancelAtPeriodEnd && currentSub.status === 'active' && (
            <button
              disabled={isPending}
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.cancelRenewal}
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Usage Meters Grid */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          {t.quotasTitle}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {Object.entries(usage.metrics).map(([key, metric]) => {
            const isUnlimited = metric.limit === null
            return (
              <div
                key={key}
                className="card"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  <span>{metric.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {metric.current} / {isUnlimited ? '∞' : metric.limit}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: 7, background: 'var(--bg-muted, #f1f5f9)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: isUnlimited ? '15%' : `${Math.min(100, metric.percent)}%`,
                      height: '100%',
                      background: metric.isExceeded
                        ? '#ef4444'
                        : metric.isWarning
                        ? '#f59e0b'
                        : 'var(--color-brand-500, #4f46e5)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ color: metric.isExceeded ? '#ef4444' : metric.isWarning ? '#f59e0b' : 'var(--text-secondary)' }}>
                    {metric.isExceeded ? t.quotaExceeded : metric.isWarning ? t.quotaWarning : t.withinLimits}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {isUnlimited ? t.unlimited : `${metric.percent}% ${t.used}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Available Plans Selector */}
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          {t.availablePlansTitle}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {availablePlans
            .filter((p) => p.code !== 'trial')
            .map((p) => {
              const isCurrent = plan.code === p.code
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    background: 'var(--bg-surface)',
                    border: isCurrent ? '2px solid var(--color-brand-500, #4f46e5)' : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    boxShadow: isCurrent ? '0 10px 25px -5px rgba(79, 70, 229, 0.1)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {p.name}
                      </h4>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            background: 'rgba(79, 70, 229, 0.1)',
                            color: 'var(--color-brand-500, #4f46e5)',
                            border: '1px solid rgba(79, 70, 229, 0.25)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                          }}
                        >
                          {t.currentBadge}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        ${Number(p.price)}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {t.perMonth}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                      {p.description}
                    </p>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={15} color="#10b981" />
                        <span>{t.teamUsers(p.maxUsers)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={15} color="#10b981" />
                        <span>{t.invoicesLimit(p.maxInvoicesPerMonth)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={15} color="#10b981" />
                        <span>{t.featuresIncluded}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isCurrent || isPending}
                    onClick={() => handleUpgrade(p.code)}
                    className={isCurrent ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: isCurrent ? 'default' : 'pointer',
                    }}
                  >
                    {isCurrent ? t.currentPlanBtn : t.switchPlan(p.name)}
                  </button>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
