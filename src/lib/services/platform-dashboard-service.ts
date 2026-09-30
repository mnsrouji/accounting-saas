// =============================================================
// Platform Dashboard Service — SaaS System & Platform Administration
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { BusinessStatus } from '@prisma/client'
import { createAuditLog } from '@/lib/audit/create-audit-log'

export interface PlatformOverviewKpis {
  totalBusinesses: number
  activeBusinesses: number
  suspendedBusinesses: number
  trialBusinesses: number
  closedBusinesses: number
  totalUsers: number
  activeUsers: number
  estimatedMrr: number
  planDistribution: Array<{
    planName: string
    code: string
    count: number
    percentage: number
  }>
  recentRegistrations: Array<{
    id: string
    name: string
    ownerName: string
    ownerEmail: string
    planName: string
    status: string
    createdAt: Date
  }>
  systemHealth: {
    status: 'healthy' | 'degraded' | 'error'
    databaseStatus: 'connected' | 'disconnected'
    uptimeSeconds: number
  }
}

export class PlatformDashboardService {
  /**
   * Get aggregate platform KPIs for Platform Administrators.
   */
  static async getPlatformOverview(): Promise<PlatformOverviewKpis> {
    const [
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      closedBusinesses,
      totalUsers,
      activeUsers,
      subscriptions,
      recentBusinesses,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { status: 'active' } }),
      prisma.business.count({ where: { status: 'suspended' } }),
      prisma.business.count({ where: { status: 'closed' } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.subscription.findMany({
        include: { plan: true },
      }),
      prisma.business.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            where: { role: 'owner' },
            include: { user: true },
            take: 1,
          },
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ])

    // Calculate plan distribution and MRR
    let trialCount = 0
    let mrrTotal = 0
    const planCounts: Record<string, { name: string; code: string; count: number; price: number }> = {}

    for (const sub of subscriptions) {
      if (sub.status === 'trialing' || sub.plan.code === 'trial') {
        trialCount++
      }

      if (sub.status === 'active' || sub.status === 'trialing') {
        const code = sub.plan.code
        const price = Number(sub.plan.price)
        if (!planCounts[code]) {
          planCounts[code] = { name: sub.plan.name, code, count: 0, price }
        }
        planCounts[code].count++

        if (sub.status === 'active') {
          mrrTotal += price
        }
      }
    }

    const totalActiveSubs = Object.values(planCounts).reduce((acc, p) => acc + p.count, 0)
    const planDistribution = Object.values(planCounts).map((p) => ({
      planName: p.name,
      code: p.code,
      count: p.count,
      percentage: totalActiveSubs > 0 ? Math.round((p.count / totalActiveSubs) * 100) : 0,
    }))

    const recentRegistrations = recentBusinesses.map((b) => {
      const owner = b.members[0]?.user
      const sub = b.subscriptions[0]
      return {
        id: b.id,
        name: b.name,
        ownerName: owner?.fullName || 'N/A',
        ownerEmail: owner?.email || 'N/A',
        planName: sub?.plan?.name || 'Free Trial',
        status: b.status,
        createdAt: b.createdAt,
      }
    })

    return {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      trialBusinesses: trialCount,
      closedBusinesses,
      totalUsers,
      activeUsers,
      estimatedMrr: mrrTotal,
      planDistribution,
      recentRegistrations,
      systemHealth: {
        status: 'healthy',
        databaseStatus: 'connected',
        uptimeSeconds: Math.floor(process.uptime()),
      },
    }
  }

  /**
   * List businesses with search, filters, pagination and metadata.
   */
  static async listTenants(params?: {
    search?: string
    status?: BusinessStatus
    limit?: number
    offset?: number
  }) {
    const { search, status, limit = 50, offset = 0 } = params || {}

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [tenants, total] = await Promise.all([
      prisma.business.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: { user: true },
          },
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              members: true,
              warehouses: true,
              sales: true,
              products: true,
            },
          },
        },
      }),
      prisma.business.count({ where }),
    ])

    const formatted = tenants.map((t) => {
      const ownerMembership = t.members.find((m) => m.role === 'owner') || t.members[0]
      const sub = t.subscriptions[0]

      return {
        id: t.id,
        name: t.name,
        legalName: t.legalName,
        status: t.status,
        country: t.country,
        currency: t.defaultCurrency,
        owner: ownerMembership
          ? {
              id: ownerMembership.user.id,
              name: ownerMembership.user.fullName,
              email: ownerMembership.user.email,
            }
          : null,
        plan: sub
          ? {
              name: sub.plan.name,
              code: sub.plan.code,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd,
            }
          : null,
        userCount: t._count.members,
        warehouseCount: t._count.warehouses,
        salesCount: t._count.sales,
        productCount: t._count.products,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return {
      tenants: formatted,
      total,
      limit,
      offset,
    }
  }

  /**
   * Update tenant status (active, suspended, closed) with platform audit logging.
   */
  static async updateTenantStatus(
    businessId: string,
    newStatus: BusinessStatus,
    adminUserId?: string,
    reason?: string
  ) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })
    if (!business) {
      throw new Error('Business not found')
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { status: newStatus },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'platform_administration',
      recordType: 'business_status',
      recordId: businessId,
      oldValues: { status: business.status },
      newValues: { status: newStatus, reason: reason || 'Platform admin action' },
    })

    return updated
  }

  /**
   * Get Platform Audit Logs across businesses.
   */
  static async getPlatformAuditLogs(limit = 100, offset = 0) {
    return prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        business: {
          select: { id: true, name: true },
        },
      },
    })
  }
}
