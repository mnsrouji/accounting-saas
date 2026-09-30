// =============================================================
// CRM Dashboard & Operational Workspaces Service
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { OpportunityService } from './opportunity-service'
import { CollectionsService } from './collections-service'
import { CrmTaskService } from './crm-task-service'
import Decimal from 'decimal.js'
import { SalesOrderStatus, PurchaseOrderStatus } from '@prisma/client'

export class CrmDashboardService {
  /**
   * Sales & CRM Pipeline Workspace.
   */
  static async getSalesWorkspace(businessId: string, assignedUserId?: string) {
    const pipelineMetrics = await OpportunityService.getPipelineMetrics(businessId, assignedUserId)

    const [openQuotations, openSalesOrders, followUpsDue, recentActivities] = await Promise.all([
      prisma.quotation.findMany({
        where: { businessId, status: { in: ['draft', 'sent'] } },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { quotationDate: 'desc' },
        take: 10,
      }),
      prisma.salesOrder.findMany({
        where: { businessId, status: { in: [SalesOrderStatus.confirmed, SalesOrderStatus.processing] } },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { orderDate: 'desc' },
        take: 10,
      }),
      CrmTaskService.getTasks(businessId, {
        assignedToId: assignedUserId,
        status: 'open',
        limit: 10,
      }),
      prisma.crmActivity.findMany({
        where: { businessId, userId: assignedUserId || undefined },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { activityDate: 'desc' },
        take: 10,
      }),
    ])

    const quotationsValue = openQuotations.reduce(
      (acc, q) => acc.plus(new Decimal(q.grandTotal)),
      new Decimal(0)
    )

    const ordersValue = openSalesOrders.reduce(
      (acc, so) => acc.plus(new Decimal(so.grandTotal)),
      new Decimal(0)
    )

    return {
      pipeline: pipelineMetrics,
      openQuotations: {
        count: openQuotations.length,
        totalValue: quotationsValue.toNumber(),
        items: openQuotations,
      },
      openSalesOrders: {
        count: openSalesOrders.length,
        totalValue: ordersValue.toNumber(),
        items: openSalesOrders,
      },
      followUpsDue,
      recentActivities,
    }
  }

  /**
   * AR Collections Workspace.
   */
  static async getCollectionsWorkspace(businessId: string, assignedCollectorId?: string) {
    return CollectionsService.getCollectionsWorkspace(businessId, { assignedCollectorId })
  }

  /**
   * Supplier & Procurement Relationship Workspace.
   */
  static async getSupplierWorkspace(businessId: string, assignedUserId?: string) {
    const now = new Date()

    const [suppliers, openPOs, pendingReceipts, overduePurchases] = await Promise.all([
      prisma.supplier.findMany({
        where: { businessId, assignedUserId: assignedUserId || undefined, deletedAt: null },
        orderBy: { balance: 'desc' },
        take: 10,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          businessId,
          status: { in: [PurchaseOrderStatus.confirmed, PurchaseOrderStatus.processing] },
        },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.goodsReceipt.findMany({
        where: { businessId, status: 'draft' },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { receiptDate: 'desc' },
      }),
      prisma.purchase.findMany({
        where: {
          businessId,
          status: { notIn: ['draft', 'voided', 'cancelled', 'paid'] },
          dueDate: { lt: now },
          balanceDue: { gt: 0 },
        },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ])

    const totalApBalance = suppliers.reduce((acc, s) => acc.plus(new Decimal(s.balance)), new Decimal(0))
    const totalOpenPoValue = openPOs.reduce((acc, po) => acc.plus(new Decimal(po.grandTotal)), new Decimal(0))
    const totalOverdueAp = overduePurchases.reduce((acc, p) => acc.plus(new Decimal(p.balanceDue)), new Decimal(0))

    return {
      totalApBalance: totalApBalance.toNumber(),
      totalOpenPoValue: totalOpenPoValue.toNumber(),
      totalOverdueAp: totalOverdueAp.toNumber(),
      openPOsCount: openPOs.length,
      pendingReceiptsCount: pendingReceipts.length,
      overduePurchasesCount: overduePurchases.length,
      topSuppliersByBalance: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        balance: Number(s.balance),
        rating: s.rating ? Number(s.rating) : null,
      })),
      recentOpenPOs: openPOs.slice(0, 10),
      pendingReceipts: pendingReceipts.slice(0, 10),
      overduePurchases: overduePurchases.slice(0, 10),
    }
  }
}
