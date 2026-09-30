// =============================================================
// Support Server Actions — Platform Operations & Recovery Tools
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { SupportToolService } from '@/lib/services/support-tool-service'
import { PlatformAnalyticsService } from '@/lib/services/platform-analytics-service'
import { BusinessStatus } from '@prisma/client'

export async function getPlatformAnalyticsAction() {
  try {
    await requirePlatformAdmin()
    const data = await PlatformAnalyticsService.getPlatformAnalytics()
    return { success: true as const, data }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Unauthorized platform administration access' }
  }
}

export async function inspectTenantAction(businessId: string) {
  try {
    await requirePlatformAdmin()
    const data = await SupportToolService.inspectTenant(businessId)
    return { success: true as const, data }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to inspect tenant' }
  }
}

export async function retryWebhookAction(eventId: string) {
  try {
    const admin = await requirePlatformAdmin()
    const record = await SupportToolService.retryBillingWebhook(eventId, admin.id)
    revalidatePath('/admin/billing')
    return { success: true as const, data: record }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to retry webhook' }
  }
}

export async function triggerSnapshotAction(businessId: string) {
  try {
    const admin = await requirePlatformAdmin()
    const snapshot = await SupportToolService.triggerTenantSnapshot(businessId, admin.id)
    revalidatePath('/admin/tenants')
    return { success: true as const, data: snapshot }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to export tenant snapshot' }
  }
}

export async function updateTenantStatusOverrideAction(
  businessId: string,
  status: BusinessStatus,
  reason?: string
) {
  try {
    const admin = await requirePlatformAdmin()
    const updated = await SupportToolService.setTenantStatus(businessId, status, admin.id, reason)
    revalidatePath('/admin')
    revalidatePath('/admin/tenants')
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update tenant status' }
  }
}
