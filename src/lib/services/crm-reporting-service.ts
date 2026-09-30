// =============================================================
// CRM & Relationship Reporting Service — Commercial BI Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { OpportunityService } from './opportunity-service'
import { Customer360Service } from './customer-360-service'
import { Supplier360Service } from './supplier-360-service'
import Decimal from 'decimal.js'

export class CrmReportingService {
  /**
   * Customer Sales Report.
   */
  static async getCustomerSalesReport(
    businessId: string,
    filters?: { customerGroupId?: string; startDate?: Date; endDate?: Date }
  ) {
    const where: any = {
      businessId,
      status: { notIn: ['draft', 'voided', 'cancelled'] },
    }
    if (filters?.startDate || filters?.endDate) {
      where.invoiceDate = {}
      if (filters.startDate) where.invoiceDate.gte = filters.startDate
      if (filters.endDate) where.invoiceDate.lte = filters.endDate
    }
    if (filters?.customerGroupId) {
      where.customer = { customerGroupId: filters.customerGroupId }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true, category: true } },
      },
    })

    const customerMap: Record<string, { customerId: string; customerName: string; code?: string; totalInvoices: number; totalSales: Decimal; totalPaid: Decimal; totalOutstanding: Decimal }> = {}

    for (const s of sales) {
      const cid = s.customerId || 'unknown'
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customerId: cid,
          customerName: s.customer?.name || 'Walk-in / Direct',
          code: s.customer?.code || undefined,
          totalInvoices: 0,
          totalSales: new Decimal(0),
          totalPaid: new Decimal(0),
          totalOutstanding: new Decimal(0),
        }
      }
      customerMap[cid].totalInvoices += 1
      customerMap[cid].totalSales = customerMap[cid].totalSales.plus(new Decimal(s.totalAmount))
      customerMap[cid].totalPaid = customerMap[cid].totalPaid.plus(new Decimal(s.paidAmount || 0))
      customerMap[cid].totalOutstanding = customerMap[cid].totalOutstanding.plus(new Decimal(s.balanceDue))
    }

    const rows = Object.values(customerMap).map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      code: c.code,
      totalInvoices: c.totalInvoices,
      totalSales: c.totalSales.toNumber(),
      totalPaid: c.totalPaid.toNumber(),
      totalOutstanding: c.totalOutstanding.toNumber(),
    }))

    rows.sort((a, b) => b.totalSales - a.totalSales)

    return {
      reportName: 'Customer Sales Summary',
      generatedAt: new Date(),
      totalCustomers: rows.length,
      rows,
    }
  }

  /**
   * Customer Profitability Report across all customers.
   */
  static async getCustomerProfitabilityReport(
    businessId: string,
    filters?: { startDate?: Date; endDate?: Date }
  ) {
    const customers = await prisma.customer.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, name: true, code: true },
    })

    const rows = []
    for (const c of customers) {
      const p = await Customer360Service.getCustomerProfitability(businessId, c.id, filters)
      if (p.metrics.totalRevenue > 0) {
        rows.push({
          customerId: c.id,
          customerName: c.name,
          code: c.code,
          totalRevenue: p.metrics.totalRevenue,
          totalCogs: p.metrics.totalCogs,
          grossProfit: p.metrics.grossProfit,
          grossMarginPercent: p.metrics.grossMarginPercent,
          averageInvoiceValue: p.metrics.averageInvoiceValue,
          invoicesCount: p.metrics.invoicesCount,
        })
      }
    }

    rows.sort((a, b) => b.grossProfit - a.grossProfit)

    return {
      reportName: 'Customer Profitability & Margin Analysis',
      generatedAt: new Date(),
      rows,
    }
  }

  /**
   * Salesperson Performance Report.
   */
  static async getSalespersonPerformanceReport(businessId: string) {
    const users = await prisma.businessUser.findMany({
      where: { businessId, status: 'active' },
      include: { user: true },
    })

    const results = []

    for (const member of users) {
      const u = member.user
      const [opps, salesOrders, invoices, activities] = await Promise.all([
        prisma.salesOpportunity.findMany({ where: { businessId, assignedUserId: u.id } }),
        prisma.salesOrder.findMany({ where: { businessId, createdBy: u.id, status: { not: 'cancelled' } } }),
        prisma.sale.findMany({ where: { businessId, createdBy: u.id, status: { notIn: ['voided', 'cancelled'] } } }),
        prisma.crmActivity.count({ where: { businessId, userId: u.id } }),
      ])

      const wonOpps = opps.filter((o) => o.stage === 'won')
      const wonValue = wonOpps.reduce((acc, o) => acc.plus(new Decimal(o.expectedValue)), new Decimal(0))
      const totalSalesOrderValue = salesOrders.reduce((acc, so) => acc.plus(new Decimal(so.grandTotal)), new Decimal(0))
      const totalInvoicedValue = invoices.reduce((acc, inv) => acc.plus(new Decimal(inv.totalAmount)), new Decimal(0))

      results.push({
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        totalOpportunities: opps.length,
        wonOpportunitiesCount: wonOpps.length,
        wonOpportunitiesValue: wonValue.toNumber(),
        totalSalesOrdersCount: salesOrders.length,
        totalSalesOrdersValue: totalSalesOrderValue.toNumber(),
        totalInvoicedValue: totalInvoicedValue.toNumber(),
        activitiesLoggedCount: activities,
      })
    }

    results.sort((a, b) => b.totalInvoicedValue - a.totalInvoicedValue)

    return {
      reportName: 'Salesperson Performance & Commercial Output',
      generatedAt: new Date(),
      rows: results,
    }
  }

  /**
   * CRM Opportunity Pipeline Report.
   */
  static async getOpportunityPipelineReport(businessId: string, assignedUserId?: string) {
    return OpportunityService.getPipelineMetrics(businessId, assignedUserId)
  }

  /**
   * Collection Activity Report.
   */
  static async getCollectionActivityReport(
    businessId: string,
    filters?: { startDate?: Date; endDate?: Date }
  ) {
    const where: any = {
      businessId,
      activityType: { in: ['call', 'email', 'whatsapp', 'follow_up', 'note'] },
    }
    if (filters?.startDate || filters?.endDate) {
      where.activityDate = {}
      if (filters.startDate) where.activityDate.gte = filters.startDate
      if (filters.endDate) where.activityDate.lte = filters.endDate
    }

    const activities = await prisma.crmActivity.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { activityDate: 'desc' },
    })

    return {
      reportName: 'Collection Activity Log & Follow-ups',
      generatedAt: new Date(),
      totalActivities: activities.length,
      rows: activities,
    }
  }

  /**
   * Broken Payment Promises Report.
   */
  static async getBrokenPromisesReport(businessId: string) {
    const brokenPromises = await prisma.paymentPromise.findMany({
      where: { businessId, status: 'broken' },
      include: {
        customer: { select: { id: true, name: true, code: true, phone: true, balance: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true } },
        assignedUser: { select: { id: true, fullName: true } },
      },
      orderBy: { promiseDate: 'desc' },
    })

    return {
      reportName: 'Broken Payment Promises & Delinquency Report',
      generatedAt: new Date(),
      totalBrokenCount: brokenPromises.length,
      rows: brokenPromises,
    }
  }

  /**
   * Supplier Purchases & Performance Report across all suppliers.
   */
  static async getSupplierPerformanceReport(businessId: string) {
    const suppliers = await prisma.supplier.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, name: true, code: true, rating: true, balance: true },
    })

    const rows = []
    for (const s of suppliers) {
      const perf = await Supplier360Service.getSupplierPerformance(businessId, s.id)
      rows.push({
        supplierId: s.id,
        supplierName: s.name,
        code: s.code,
        rating: s.rating ? Number(s.rating) : null,
        currentBalance: Number(s.balance),
        totalPurchaseVolume: perf.totalPurchaseVolume,
        purchaseOrdersCount: perf.purchaseOrdersCount,
        averageLeadTimeDays: perf.averageLeadTimeDays,
        lateReceiptRatePercent: perf.lateReceiptRatePercent,
        fillRatePercent: perf.fillRatePercent,
        returnRatePercent: perf.returnRatePercent,
        qualityIncidentsCount: perf.qualityIncidentsCount,
      })
    }

    rows.sort((a, b) => b.totalPurchaseVolume - a.totalPurchaseVolume)

    return {
      reportName: 'Supplier Commercial & Performance Scorecard',
      generatedAt: new Date(),
      rows,
    }
  }
}
