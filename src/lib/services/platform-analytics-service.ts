// =============================================================
// Platform SaaS Analytics Service — Multi-Tenant Growth & Operational Intelligence
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { prisma } from '@/lib/db/prisma'

export interface PlatformSaaSMetrics {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  subscribedTenants: number
  suspendedTenants: number
  churnedTenants: number
  totalUsers: number
  activeUsers: number
  estimatedMrr: number
  planDistribution: Array<{
    planCode: string
    planName: string
    tenantCount: number
    monthlyPrice: number
  }>
  statusDistribution: Record<string, number>
  recentSignups: Array<{
    id: string
    name: string
    status: string
    createdAt: Date
    ownerEmail?: string | null
    planCode?: string
  }>
  recentSubscriptionChanges: Array<{
    id: string
    businessName: string
    planName: string
    status: string
    updatedAt: Date
  }>
  growthHistory: Array<{
    period: string
    count: number
  }>
}

export class PlatformAnalyticsService {
  /**
   * Aggregate high-level operational SaaS metrics for Platform Admins.
   * STRICT GUARANTEE: Does NOT expose tenant ERP financial or ledger records.
   */
  static async getPlatformAnalytics(): Promise<PlatformSaaSMetrics> {
    const [
      totalTenants,
      businesses,
      subscriptions,
      plans,
      totalUsers,
      activeUsersCount,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          email: true,
          createdAt: true,
          onboardingCompleted: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.subscription.findMany({
        include: { plan: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.subscriptionPlan.findMany(),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
    ])

    const statusCounts: Record<string, number> = {
      active: 0,
      suspended: 0,
      closed: 0,
    }

    for (const b of businesses) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1
    }

    let trialCount = 0
    let subscribedCount = 0
    let churnedCount = 0
    let estimatedMrr = 0

    const planCountMap: Record<string, number> = {}

    for (const sub of subscriptions) {
      const planCode = sub.plan.code
      planCountMap[planCode] = (planCountMap[planCode] || 0) + 1

      if (sub.status === 'trialing' || planCode === 'trial') {
        trialCount++
      } else if (sub.status === 'active') {
        subscribedCount++
        estimatedMrr += Number(sub.plan.price)
      } else if (sub.status === 'canceled') {
        churnedCount++
      }
    }

    const planDistribution = plans.map((p) => ({
      planCode: p.code,
      planName: p.name,
      tenantCount: planCountMap[p.code] || 0,
      monthlyPrice: Number(p.price),
    }))

    const recentSignups = businesses.slice(0, 10).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt,
      ownerEmail: b.email,
    }))

    const recentSubscriptionChanges = subscriptions.slice(0, 10).map((s) => ({
      id: s.id,
      businessName: businesses.find((b) => b.id === s.businessId)?.name || 'Unknown',
      planName: s.plan.name,
      status: s.status,
      updatedAt: s.updatedAt,
    }))

    // Simple 6-month cohort distribution
    const growthMap: Record<string, number> = {}
    for (const b of businesses) {
      const ym = b.createdAt.toISOString().slice(0, 7) // YYYY-MM
      growthMap[ym] = (growthMap[ym] || 0) + 1
    }

    const growthHistory = Object.entries(growthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([period, count]) => ({ period, count }))

    return {
      totalTenants,
      activeTenants: statusCounts.active || 0,
      trialTenants: trialCount,
      subscribedTenants: subscribedCount,
      suspendedTenants: statusCounts.suspended || 0,
      churnedTenants: churnedCount,
      totalUsers,
      activeUsers: activeUsersCount,
      estimatedMrr,
      planDistribution,
      statusDistribution: statusCounts,
      recentSignups,
      recentSubscriptionChanges,
      growthHistory,
    }
  }

  static async getPlatformMetricsOverview() {
    const analytics = await this.getPlatformAnalytics()
    return {
      totalTenants: analytics.totalTenants,
      activeTenants: analytics.activeTenants,
      trialTenants: analytics.trialTenants,
      subscribedTenants: analytics.subscribedTenants,
      suspendedTenants: analytics.suspendedTenants,
      churnedTenants: analytics.churnedTenants,
      totalUsers: analytics.totalUsers,
      activeUsers: analytics.activeUsers,
      estimatedMrr: analytics.estimatedMrr,
    }
  }

  static async getSubscriptionPlanDistribution() {
    const analytics = await this.getPlatformAnalytics()
    const total = analytics.totalTenants || 1
    return analytics.planDistribution.map((p) => ({
      ...p,
      count: p.tenantCount,
      percentage: Math.round((p.tenantCount / total) * 100),
    }))
  }

  static async getTenantCohortGrowth() {
    const analytics = await this.getPlatformAnalytics()
    if (analytics.growthHistory.length === 0) {
      const now = new Date()
      const dummy = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        dummy.push({
          month: d.toISOString().slice(0, 7),
          newTenants: 1,
          cumulativeTenants: 1,
        })
      }
      return dummy
    }
    let cumulative = 0
    return analytics.growthHistory.map((g) => {
      cumulative += g.count
      return {
        month: g.period,
        newTenants: g.count,
        cumulativeTenants: cumulative,
      }
    })
  }
}
