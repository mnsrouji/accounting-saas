// =============================================================
// Commercial Reporting Service — Operational Pipeline Analytics
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'

export class CommercialReportingService {
  /**
   * Get operational overview statistics for sales & procurement pipeline.
   */
  static async getOperationalSummary(businessId: string) {
    const [
      openQuotationsCount,
      acceptedQuotationsCount,
      openSalesOrdersCount,
      pendingDeliveriesCount,
      openPurchaseOrdersCount,
      pendingReceiptsCount,
      salesReturnsCount,
      purchaseReturnsCount,
    ] = await Promise.all([
      prisma.quotation.count({
        where: { businessId, status: { in: ['draft', 'sent'] } },
      }),
      prisma.quotation.count({
        where: { businessId, status: 'accepted' },
      }),
      prisma.salesOrder.count({
        where: { businessId, status: { in: ['draft', 'confirmed', 'processing'] } },
      }),
      prisma.deliveryNote.count({
        where: { businessId, status: 'draft' },
      }),
      prisma.purchaseOrder.count({
        where: { businessId, status: { in: ['draft', 'confirmed', 'processing'] } },
      }),
      prisma.goodsReceipt.count({
        where: { businessId, status: 'draft' },
      }),
      prisma.salesReturn.count({
        where: { businessId },
      }),
      prisma.purchaseReturn.count({
        where: { businessId },
      }),
    ])

    return {
      openQuotationsCount,
      acceptedQuotationsCount,
      openSalesOrdersCount,
      pendingDeliveriesCount,
      openPurchaseOrdersCount,
      pendingReceiptsCount,
      salesReturnsCount,
      purchaseReturnsCount,
    }
  }

  /**
   * Open Quotations Report
   */
  static async getOpenQuotationsReport(businessId: string) {
    return prisma.quotation.findMany({
      where: { businessId, status: { in: ['draft', 'sent'] } },
      include: { customer: true },
      orderBy: { quotationDate: 'desc' },
    })
  }

  /**
   * Accepted Quotations Report
   */
  static async getAcceptedQuotationsReport(businessId: string) {
    return prisma.quotation.findMany({
      where: { businessId, status: 'accepted' },
      include: { customer: true },
      orderBy: { quotationDate: 'desc' },
    })
  }

  /**
   * Open Sales Orders Report
   */
  static async getOpenSalesOrdersReport(businessId: string) {
    return prisma.salesOrder.findMany({
      where: { businessId, status: { in: ['draft', 'confirmed', 'processing'] } },
      include: { customer: true, warehouse: true },
      orderBy: { orderDate: 'desc' },
    })
  }

  /**
   * Pending Deliveries Report
   */
  static async getPendingDeliveriesReport(businessId: string) {
    return prisma.deliveryNote.findMany({
      where: { businessId, status: 'draft' },
      include: { customer: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { deliveryDate: 'desc' },
    })
  }

  /**
   * Open Purchase Orders Report
   */
  static async getOpenPurchaseOrdersReport(businessId: string) {
    return prisma.purchaseOrder.findMany({
      where: { businessId, status: { in: ['draft', 'confirmed', 'processing'] } },
      include: { supplier: true, warehouse: true },
      orderBy: { orderDate: 'desc' },
    })
  }

  /**
   * Pending Goods Receipts Report
   */
  static async getPendingReceiptsReport(businessId: string) {
    return prisma.goodsReceipt.findMany({
      where: { businessId, status: 'draft' },
      include: { supplier: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { receiptDate: 'desc' },
    })
  }

  /**
   * Sales Returns Report
   */
  static async getSalesReturnsReport(businessId: string) {
    return prisma.salesReturn.findMany({
      where: { businessId },
      include: { customer: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { returnDate: 'desc' },
    })
  }

  /**
   * Purchase Returns Report
   */
  static async getPurchaseReturnsReport(businessId: string) {
    return prisma.purchaseReturn.findMany({
      where: { businessId },
      include: { supplier: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { returnDate: 'desc' },
    })
  }
}
