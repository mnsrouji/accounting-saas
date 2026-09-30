// =============================================================
// Billing Settings Page — Server Component
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================

import { requireUser } from '@/lib/auth/require-auth'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { BillingService } from '@/lib/billing/billing-service'
import { getBillingProvider } from '@/lib/billing/billing-registry'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import BillingPageClient from './BillingPageClient'

interface PageProps {
  params: Promise<{ businessId: string }>
}

export const metadata = {
  title: 'Billing & Payments | Settings',
  description: 'Manage your subscription, invoices, and payment methods',
}

export default async function BillingSettingsPage({ params }: PageProps) {
  await requireUser()
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [rawSub, rawInvoices, provider] = await Promise.all([
    SubscriptionService.getSubscription(businessId),
    BillingService.getInvoices(businessId).catch(() => []),
    Promise.resolve(getBillingProvider()),
  ])

  const subscription = JSON.parse(JSON.stringify(rawSub))
  const invoices = JSON.parse(JSON.stringify(rawInvoices))

  const t = {
    title: isAr ? 'الفواتير والمدفوعات' : isTr ? 'Faturalar ve Ödemeler' : 'Billing & Payments',
    subtitle: isAr
      ? 'إدارة اشتراك المنشأة، وسائل الدفع، واستعراض سجل الفواتير والمستحقات'
      : isTr
      ? 'Aboneliğinizi, ödeme yöntemlerinizi ve fatura geçmişinizi yönetin'
      : 'Manage your subscription, payment methods, and invoice history',
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

      <BillingPageClient
        businessId={businessId}
        providerName={provider.providerId}
        subscription={{
          status: subscription.status,
          isTrial: subscription.isTrial,
          daysRemainingInTrial: subscription.daysRemainingInTrial,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: {
            name: subscription.plan.name,
            code: subscription.plan.code,
            price: Number(subscription.plan.price),
            billingInterval: subscription.plan.billingInterval,
          },
        }}
        invoices={invoices}
      />
    </div>
  )
}
