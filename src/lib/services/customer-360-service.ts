// =============================================================
// Customer 360 & Commercial Intelligence Service
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { TenantAccessDeniedError } from '@/lib/errors/accounting-error'
import { CreditControlService } from './credit-control-service'
import { StatementService } from './statement-service'
import Decimal from 'decimal.js'

export interface CustomerTimelineItem {
  id: string
  type:
    | 'quotation'
    | 'sales_order'
    | 'delivery_note'
    | 'invoice'
    | 'payment'
    | 'return'
    | 'credit_note'
    | 'activity'
    | 'task'
    | 'promise'
  documentNumber?: string
  date: Date
  status?: string
  amount?: number
  description: string
  referenceId?: string
}

export class Customer360Service {
  /**
   * Complete unified Customer 360 profile.
   */
  static async getCustomer360(businessId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
      include: {
        customerGroup: true,
        assignedUser: { select: { id: true, fullName: true, email: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    // Credit and Exposure metrics
    const creditMetrics = await CreditControlService.getCreditMetrics(businessId, customerId)

    // Parallel fetch operational records
    const [
      sales,
      payments,
      salesOrders,
      quotations,
      deliveryNotes,
      salesReturns,
      creditNotes,
      activities,
      tasks,
      opportunities,
      paymentPromises,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId, customerId, status: { notIn: ['voided', 'cancelled'] } },
        include: { items: true },
        orderBy: { invoiceDate: 'desc' },
      }),
      prisma.payment.findMany({
        where: { businessId, customerId, type: 'incoming', status: 'posted' },
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.salesOrder.findMany({
        where: { businessId, customerId },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.quotation.findMany({
        where: { businessId, customerId },
        orderBy: { quotationDate: 'desc' },
      }),
      prisma.deliveryNote.findMany({
        where: { businessId, customerId },
        orderBy: { deliveryDate: 'desc' },
      }),
      prisma.salesReturn.findMany({
        where: { businessId, customerId },
        orderBy: { returnDate: 'desc' },
      }),
      prisma.creditDebitNote.findMany({
        where: { businessId, customerId, type: 'credit_note' },
        orderBy: { noteDate: 'desc' },
      }),
      prisma.crmActivity.findMany({
        where: { businessId, customerId },
        include: { user: true, customerContact: true },
        orderBy: { activityDate: 'desc' },
        take: 30,
      }),
      prisma.crmTask.findMany({
        where: { businessId, customerId },
        include: { assignedTo: true },
        orderBy: { dueDate: 'asc' },
        take: 30,
      }),
      prisma.salesOpportunity.findMany({
        where: { businessId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentPromise.findMany({
        where: { businessId, customerId },
        orderBy: { promiseDate: 'desc' },
      }),
    ])

    // Compute Commercial Totals
    let totalSalesRevenue = new Decimal(0)
    let totalCogs = new Decimal(0)

    for (const s of sales) {
      if (s.status !== 'draft') {
        totalSalesRevenue = totalSalesRevenue.plus(new Decimal(s.totalAmount))
        for (const item of s.items) {
          const qty = new Decimal(item.quantity)
          const cost = new Decimal(item.costBasis || 0)
          totalCogs = totalCogs.plus(qty.mul(cost))
        }
      }
    }

    const grossProfit = totalSalesRevenue.minus(totalCogs)
    const grossMarginPercent = totalSalesRevenue.gt(0)
      ? grossProfit.div(totalSalesRevenue).mul(100).toNumber()
      : 0

    const totalPaid = payments.reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0))
    const totalReturns = salesReturns.reduce((acc, r) => acc.plus(new Decimal(r.totalAmount || 0)), new Decimal(0))
    const totalCreditNotes = creditNotes.reduce((acc, c) => acc.plus(new Decimal(c.totalAmount || 0)), new Decimal(0))

    const openOrdersCount = salesOrders.filter((o) => o.status === 'confirmed' || o.status === 'processing').length
    const pendingDeliveriesCount = deliveryNotes.filter((d) => d.status === 'draft' || d.status === 'confirmed').length

    // Build unified chronological document timeline
    const timeline: CustomerTimelineItem[] = []

    quotations.forEach((q) => {
      timeline.push({
        id: q.id,
        type: 'quotation',
        documentNumber: q.quotationNumber,
        date: q.quotationDate,
        status: q.status,
        amount: Number(q.grandTotal),
        description: `Quotation ${q.quotationNumber} (${q.status})`,
      })
    })

    salesOrders.forEach((so) => {
      timeline.push({
        id: so.id,
        type: 'sales_order',
        documentNumber: so.orderNumber,
        date: so.orderDate,
        status: so.status,
        amount: Number(so.grandTotal),
        description: `Sales Order ${so.orderNumber} (${so.status})`,
      })
    })

    deliveryNotes.forEach((dn) => {
      timeline.push({
        id: dn.id,
        type: 'delivery_note',
        documentNumber: dn.deliveryNumber,
        date: dn.deliveryDate,
        status: dn.status,
        description: `Delivery Note ${dn.deliveryNumber} (${dn.status})`,
      })
    })

    sales.forEach((inv) => {
      timeline.push({
        id: inv.id,
        type: 'invoice',
        documentNumber: inv.invoiceNumber,
        date: inv.invoiceDate,
        status: inv.status,
        amount: Number(inv.totalAmount),
        description: `Invoice ${inv.invoiceNumber} (${inv.status}) - Bal: $${Number(inv.balanceDue).toFixed(2)}`,
      })
    })

    payments.forEach((pay) => {
      timeline.push({
        id: pay.id,
        type: 'payment',
        documentNumber: pay.paymentNumber,
        date: pay.paymentDate,
        status: pay.status,
        amount: Number(pay.amount),
        description: `Payment ${pay.paymentNumber} via ${pay.method}`,
      })
    })

    salesReturns.forEach((ret) => {
      timeline.push({
        id: ret.id,
        type: 'return',
        documentNumber: ret.returnNumber,
        date: ret.returnDate,
        status: ret.status,
        amount: Number(ret.totalAmount || 0),
        description: `Sales Return ${ret.returnNumber}`,
      })
    })

    creditNotes.forEach((cn) => {
      timeline.push({
        id: cn.id,
        type: 'credit_note',
        documentNumber: cn.noteNumber,
        date: cn.noteDate,
        status: cn.status,
        amount: Number(cn.totalAmount),
        description: `Credit Note ${cn.noteNumber}`,
      })
    })

    activities.forEach((act) => {
      timeline.push({
        id: act.id,
        type: 'activity',
        date: act.activityDate,
        status: act.status,
        description: `[${act.activityType.toUpperCase()}] ${act.subject}`,
      })
    })

    paymentPromises.forEach((pr) => {
      timeline.push({
        id: pr.id,
        type: 'promise',
        date: pr.promiseDate,
        status: pr.status,
        amount: Number(pr.promisedAmount),
        description: `Payment Promise: $${Number(pr.promisedAmount).toFixed(2)} (${pr.status})`,
      })
    })

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        whatsapp: customer.whatsapp,
        website: customer.website,
        address: customer.address,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        country: customer.country,
        taxNumber: customer.taxNumber,
        category: customer.category,
        industry: customer.industry,
        region: customer.region,
        tags: customer.tags,
        group: customer.customerGroup?.name,
        assignedUser: customer.assignedUser,
        paymentTerms: customer.paymentTerms,
        creditStatus: customer.creditStatus,
        creditCategory: customer.creditCategory,
        notes: customer.notes,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      },
      contacts: customer.contacts,
      creditMetrics,
      financialSummary: {
        totalSales: totalSalesRevenue.toNumber(),
        grossProfit: grossProfit.toNumber(),
        grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
        totalPaid: totalPaid.toNumber(),
        totalReturns: totalReturns.toNumber(),
        totalCreditNotes: totalCreditNotes.toNumber(),
        invoicesCount: sales.length,
        paymentsCount: payments.length,
        openOrdersCount,
        pendingDeliveriesCount,
      },
      opportunities,
      activities,
      tasks,
      paymentPromises,
      timeline: timeline.slice(0, 50),
    }
  }

  /**
   * In-depth Customer Profitability & Commercial Analytics.
   */
  static async getCustomerProfitability(
    businessId: string,
    customerId: string,
    dateRange?: { startDate?: Date; endDate?: Date }
  ) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const salesWhere: any = {
      businessId,
      customerId,
      status: { notIn: ['draft', 'voided', 'cancelled'] },
    }
    if (dateRange?.startDate || dateRange?.endDate) {
      salesWhere.invoiceDate = {}
      if (dateRange.startDate) salesWhere.invoiceDate.gte = dateRange.startDate
      if (dateRange.endDate) salesWhere.invoiceDate.lte = dateRange.endDate
    }

    const [sales, returns, payments] = await Promise.all([
      prisma.sale.findMany({
        where: salesWhere,
        include: { items: true },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.salesReturn.findMany({
        where: { businessId, customerId, status: { notIn: ['draft', 'cancelled'] } },
      }),
      prisma.payment.findMany({
        where: { businessId, customerId, type: 'incoming', status: 'posted' },
        include: { allocations: { include: { sale: true } } },
      }),
    ])

    let totalRevenue = new Decimal(0)
    let totalCogs = new Decimal(0)
    let totalDiscounts = new Decimal(0)
    let lastTransactionDate: Date | null = null

    // Monthly sales trend map
    const trendMap: Record<string, { month: string; sales: Decimal; grossProfit: Decimal }> = {}

    for (const sale of sales) {
      const saleTotal = new Decimal(sale.totalAmount)
      const discount = new Decimal(sale.discountAmount || 0)
      totalRevenue = totalRevenue.plus(saleTotal)
      totalDiscounts = totalDiscounts.plus(discount)

      if (!lastTransactionDate || new Date(sale.invoiceDate) > lastTransactionDate) {
        lastTransactionDate = new Date(sale.invoiceDate)
      }

      let saleCogs = new Decimal(0)
      for (const item of sale.items) {
        const qty = new Decimal(item.quantity)
        const cost = new Decimal(item.costBasis || 0)
        saleCogs = saleCogs.plus(qty.mul(cost))
      }
      totalCogs = totalCogs.plus(saleCogs)

      const monthKey = new Date(sale.invoiceDate).toISOString().substring(0, 7) // YYYY-MM
      if (!trendMap[monthKey]) {
        trendMap[monthKey] = { month: monthKey, sales: new Decimal(0), grossProfit: new Decimal(0) }
      }
      trendMap[monthKey].sales = trendMap[monthKey].sales.plus(saleTotal)
      trendMap[monthKey].grossProfit = trendMap[monthKey].grossProfit.plus(saleTotal.minus(saleCogs))
    }

    const totalReturnsValue = returns.reduce(
      (acc, r) => acc.plus(new Decimal(r.totalAmount || 0)),
      new Decimal(0)
    )

    const grossProfit = totalRevenue.minus(totalCogs).minus(totalReturnsValue)
    const grossMarginPercent = totalRevenue.gt(0)
      ? grossProfit.div(totalRevenue).mul(100).toNumber()
      : 0

    const averageInvoiceValue = sales.length > 0
      ? totalRevenue.div(sales.length).toNumber()
      : 0

    // Payment behavior analysis: average days to pay & on-time payment rate
    let totalDaysToPay = 0
    let paidInvoicesCount = 0
    let onTimePaymentsCount = 0

    for (const p of payments) {
      for (const alloc of p.allocations) {
        if (alloc.sale && alloc.sale.dueDate) {
          paidInvoicesCount++
          const payDate = new Date(p.paymentDate).getTime()
          const invDate = new Date(alloc.sale.invoiceDate).getTime()
          const dueDate = new Date(alloc.sale.dueDate).getTime()

          const days = Math.max(0, Math.floor((payDate - invDate) / (1000 * 60 * 60 * 24)))
          totalDaysToPay += days

          if (payDate <= dueDate) {
            onTimePaymentsCount++
          }
        }
      }
    }

    const averageDaysToPay = paidInvoicesCount > 0
      ? Math.round(totalDaysToPay / paidInvoicesCount)
      : customer.paymentTerms || 30

    const onTimePaymentRate = paidInvoicesCount > 0
      ? Math.round((onTimePaymentsCount / paidInvoicesCount) * 100)
      : 100

    // Historical Customer Lifetime Value
    const customerLifetimeValue = totalRevenue.minus(totalReturnsValue).toNumber()

    return {
      customerId: customer.id,
      customerName: customer.name,
      period: {
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      },
      metrics: {
        totalRevenue: totalRevenue.toNumber(),
        totalCogs: totalCogs.toNumber(),
        totalReturns: totalReturnsValue.toNumber(),
        returnsCount: returns.length,
        totalDiscounts: totalDiscounts.toNumber(),
        grossProfit: grossProfit.toNumber(),
        grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
        invoicesCount: sales.length,
        averageInvoiceValue: Math.round(averageInvoiceValue * 100) / 100,
        currentOutstandingBalance: Number(customer.balance),
        customerLifetimeValue,
      },
      paymentBehavior: {
        averageDaysToPay,
        onTimePaymentRate,
        paidInvoicesAnalyzed: paidInvoicesCount,
      },
      salesFrequency: {
        lastTransactionDate,
        totalTransactions: sales.length,
        monthlyTrend: Object.values(trendMap).map((t) => ({
          month: t.month,
          sales: t.sales.toNumber(),
          grossProfit: t.grossProfit.toNumber(),
        })),
      },
    }
  }
}
