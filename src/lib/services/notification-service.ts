// =============================================================
// Notification Service — Centralized In-App & Operational Alerts
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { prisma } from '@/lib/db/prisma'

export interface CreateNotificationParams {
  businessId: string
  userId: string
  title: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'success'
  category?: 'billing' | 'inventory' | 'sales' | 'security' | 'system'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  link?: string
}

export class NotificationService {
  /**
   * Dispatch an in-app notification to a user.
   */
  static async sendNotification(params: CreateNotificationParams) {
    return this.createNotification(params)
  }

  static async createNotification(params: CreateNotificationParams) {
    return prisma.notification.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        category: params.category || 'system',
        priority: params.priority || 'normal',
        link: params.link,
        isRead: false,
      },
    })
  }

  /**
   * Fetch paginated notifications for a user within a business.
   */
  static async getNotifications(
    businessId: string,
    userId: string,
    options?: {
      unreadOnly?: boolean
      category?: string
      limit?: number
      offset?: number
    }
  ) {
    const where: Record<string, unknown> = {
      businessId,
      userId,
    }

    if (options?.unreadOnly) {
      where.isRead = false
    }
    if (options?.category) {
      where.category = options.category
    }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { businessId, userId, isRead: false },
      }),
    ])

    return {
      items,
      notifications: items,
      total,
      unreadCount,
    }
  }

  /**
   * Mark a single notification as read.
   */
  static async markAsRead(notificationId: string, paramA?: string, paramB?: string) {
    const userId = paramB || paramA
    const where: Record<string, unknown> = { id: notificationId }
    if (userId) {
      where.userId = userId
    }

    const res = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    })

    return {
      success: true,
      isRead: true,
      count: res.count,
    }
  }

  /**
   * Mark all notifications as read for a business user.
   */
  static async markAllAsRead(businessId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { businessId, userId, isRead: false },
      data: { isRead: true },
    })
  }

  /**
   * Get total unread count for badge indicators.
   */
  static async getUnreadCount(businessId: string, userId: string): Promise<number> {
    return prisma.notification.count({
      where: { businessId, userId, isRead: false },
    })
  }
}
