// =============================================================
// Subscription Service — Tenant SaaS Subscriptions & Lifecycle
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { PlanService } from './plan-service'
import { createAuditLog } from '@/lib/audit/create-audit-log'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled'

export interface SubscriptionDetails {
  id: string
  businessId: string
  status: SubscriptionStatus
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
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  isTrial: boolean
  daysRemainingInTrial?: number
  isUsable: boolean
}

export class SubscriptionService {
  /**
   * Get the active or most relevant subscription for a business.
   * If none exists, automatically provisions the default Trial subscription.
   */
  static async getSubscription(businessId: string): Promise<SubscriptionDetails> {
    let sub = await prisma.subscription.findFirst({
      where: { businessId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!sub) {
      // Auto-provision Free Trial for the business
      sub = await this.provisionTrial(businessId)
    }

    const now = new Date()
    const isTrial = sub.plan.code === 'trial' || sub.status === 'trialing'
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )

    const isUsable = sub.status === 'active' || (sub.status === 'trialing' && daysRemaining > 0)

    return {
      id: sub.id,
      businessId: sub.businessId,
      status: sub.status as SubscriptionStatus,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        code: sub.plan.code,
        price: Number(sub.plan.price),
        billingInterval: sub.plan.billingInterval,
        maxUsers: sub.plan.maxUsers,
        maxInvoicesPerMonth: sub.plan.maxInvoicesPerMonth,
        features: (sub.plan.features as Record<string, boolean>) || {},
      },
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      isTrial,
      daysRemainingInTrial: isTrial ? daysRemaining : undefined,
      isUsable,
    }
  }

  /**
   * Provision a 14-day Free Trial subscription for a new business.
   */
  static async provisionTrial(businessId: string) {
    const trialPlan = await PlanService.getPlanByCode('trial')
    if (!trialPlan) {
      throw new Error('Trial plan not configured')
    }

    const start = new Date()
    const end = new Date()
    end.setDate(start.getDate() + 14)

    return prisma.subscription.create({
      data: {
        businessId,
        planId: trialPlan.id,
        status: 'trialing',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    })
  }

  /**
   * Create or update a business subscription to a specific plan tier.
   */
  static async changePlan(
    businessId: string,
    planCode: string,
    options?: {
      billingInterval?: 'month' | 'year'
      userId?: string
    }
  ) {
    const plan = await PlanService.getPlanByCode(planCode)
    if (!plan) {
      throw new Error(`Plan with code "${planCode}" not found`)
    }

    const start = new Date()
    const end = new Date()
    if (options?.billingInterval === 'year') {
      end.setFullYear(start.getFullYear() + 1)
    } else {
      end.setMonth(start.getMonth() + 1)
    }

    const existing = await prisma.subscription.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })

    let updated
    if (existing) {
      updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
        include: { plan: true },
      })
    } else {
      updated = await prisma.subscription.create({
        data: {
          businessId,
          planId: plan.id,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
        include: { plan: true },
      })
    }

    await createAuditLog({
      businessId,
      userId: options?.userId,
      action: 'update',
      module: 'subscription',
      recordType: 'subscription',
      recordId: updated.id,
      newValues: { planCode, status: 'active', planName: plan.name },
    })

    return this.getSubscription(businessId)
  }

  /**
   * Update subscription status (Platform Admin or automated webhook/scheduler).
   */
  static async updateStatus(
    businessId: string,
    status: SubscriptionStatus,
    userId?: string
  ) {
    const sub = await prisma.subscription.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })
    if (!sub) {
      throw new Error('Subscription not found for business')
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status },
      include: { plan: true },
    })

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'subscription',
      recordType: 'subscription',
      recordId: updated.id,
      newValues: { status },
    })

    return this.getSubscription(businessId)
  }

  /**
   * Cancel subscription at period end or immediately.
   */
  static async cancelSubscription(businessId: string, immediate = false, userId?: string) {
    const sub = await prisma.subscription.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })
    if (!sub) throw new Error('Subscription not found')

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: immediate ? 'canceled' : sub.status,
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    })

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'subscription',
      recordType: 'subscription',
      recordId: updated.id,
      newValues: { cancelAtPeriodEnd: true, status: updated.status },
    })

    return this.getSubscription(businessId)
  }

  /**
   * Verify if a business has an active usable subscription.
   */
  static async checkSubscriptionValidity(businessId: string): Promise<boolean> {
    const sub = await this.getSubscription(businessId)
    return sub.isUsable
  }
}
