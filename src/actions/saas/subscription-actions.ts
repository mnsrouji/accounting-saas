// =============================================================
// Subscription Server Actions — Tenant Subscriptions & Usage Quotas
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { UsageService } from '@/lib/services/usage-service'
import { PlanService } from '@/lib/services/plan-service'

export async function getSubscriptionDetailsAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const subscription = await SubscriptionService.getSubscription(businessId)
    const usage = await UsageService.getTenantUsageSummary(businessId)
    const availablePlans = await PlanService.getPlans()

    return {
      success: true as const,
      data: {
        subscription,
        usage,
        availablePlans,
      },
    }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch subscription details' }
  }
}

export async function changeSubscriptionPlanAction(
  businessId: string,
  planCode: string,
  billingInterval: 'month' | 'year' = 'month'
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    const updated = await SubscriptionService.changePlan(businessId, planCode, {
      billingInterval,
      userId,
    })

    revalidatePath(`/b/${businessId}/settings`)
    revalidatePath(`/b/${businessId}/dashboard`)
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to change plan' }
  }
}

export async function cancelSubscriptionAction(businessId: string, immediate = false) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    const updated = await SubscriptionService.cancelSubscription(businessId, immediate, userId)

    revalidatePath(`/b/${businessId}/settings`)
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to cancel subscription' }
  }
}

export async function getTenantUsageAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const usage = await UsageService.getTenantUsageSummary(businessId)
    return { success: true as const, data: usage }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch usage metrics' }
  }
}
