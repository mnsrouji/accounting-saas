// =============================================================
// Notification Server Actions — In-App Alert Management
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { NotificationService } from '@/lib/services/notification-service'

export async function getNotificationsAction(
  businessId: string,
  options?: { unreadOnly?: boolean; category?: string; limit?: number }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const result = await NotificationService.getNotifications(businessId, userId, options)
    return { success: true as const, data: result }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch notifications' }
  }
}

export async function markNotificationAsReadAction(businessId: string, notificationId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    await NotificationService.markAsRead(notificationId, userId)
    revalidatePath(`/b/${businessId}`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update notification' }
  }
}

export async function markAllNotificationsAsReadAction(businessId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    await NotificationService.markAllAsRead(businessId, userId)
    revalidatePath(`/b/${businessId}`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to mark all as read' }
  }
}
