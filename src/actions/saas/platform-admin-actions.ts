// =============================================================
// Platform Admin Server Actions — SaaS Platform Operations
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { PlatformDashboardService } from '@/lib/services/platform-dashboard-service'
import { BusinessStatus } from '@prisma/client'

export async function getPlatformOverviewAction() {
  try {
    await requirePlatformAdmin()
    const overview = await PlatformDashboardService.getPlatformOverview()
    return { success: true as const, data: overview }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Unauthorized platform administration access' }
  }
}

export async function listPlatformTenantsAction(params?: {
  search?: string
  status?: BusinessStatus
  limit?: number
  offset?: number
}) {
  try {
    await requirePlatformAdmin()
    const result = await PlatformDashboardService.listTenants(params)
    return { success: true as const, data: result }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to list platform tenants' }
  }
}

export async function updateTenantStatusAction(
  businessId: string,
  newStatus: BusinessStatus,
  reason?: string
) {
  try {
    const adminUser = await requirePlatformAdmin()
    const updated = await PlatformDashboardService.updateTenantStatus(
      businessId,
      newStatus,
      adminUser.id,
      reason
    )

    revalidatePath('/admin')
    revalidatePath('/admin/tenants')
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update tenant status' }
  }
}

export async function getPlatformAuditLogsAction(limit = 100, offset = 0) {
  try {
    await requirePlatformAdmin()
    const logs = await PlatformDashboardService.getPlatformAuditLogs(limit, offset)
    return { success: true as const, data: logs }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch platform audit logs' }
  }
}
