// =============================================================
// Tenant Subscription Settings Page — Plan & Usage Center
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { UsageService } from '@/lib/services/usage-service'
import { PlanService } from '@/lib/services/plan-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import SubscriptionManagerClient from './SubscriptionManagerClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Subscription & Usage | AccountFlow',
}

interface Props {
  params: Promise<{ businessId: string }>
}

export default async function TenantSubscriptionPage({ params }: Props) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const [rawSub, rawUsage, rawPlans] = await Promise.all([
    SubscriptionService.getSubscription(businessId),
    UsageService.getTenantUsageSummary(businessId),
    PlanService.getPlans(),
  ])

  // Safely serialize objects to plain JSON for Client Component boundary
  const subscription = JSON.parse(JSON.stringify(rawSub))
  const usage = JSON.parse(JSON.stringify(rawUsage))
  const availablePlans = JSON.parse(JSON.stringify(rawPlans))

  const t = {
    title: isAr ? 'الاشتراك وسعة الاستخدام' : isTr ? 'Abonelik ve Kullanım Kotaları' : 'Subscription & Usage Quotas',
    subtitle: isAr
      ? 'إدارة خطة واشتراك المنشأة، متابعة مؤشرات السعة والاستهلاك لحظياً، وإدارة الفواتير'
      : isTr
      ? 'Kuruluş paketini yönetin, gerçek zamanlı kapasite sayaçlarını görüntüleyin ve faturalandırmayı yapılandırın'
      : 'Manage your organization tier, view real-time capacity meters, and configure billing',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <SubscriptionManagerClient
        businessId={businessId}
        subscription={subscription}
        usage={usage}
        availablePlans={availablePlans}
      />
    </div>
  )
}
