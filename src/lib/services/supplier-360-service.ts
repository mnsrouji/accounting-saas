// =============================================================
// Supplier 360 & Supplier Performance Intelligence Service
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { TenantAccessDeniedError } from '@/lib/errors/accounting-error'
import Decimal from 'decimal.js'

export interface SupplierTimelineItem {
  id: string
  type: 'purchase_order' | 'goods_receipt' | 'bill' | 'payment' | 'return' | 'debit_note' | 'activity' | 'task'
  documentNumber?: string
  date: Date
  status?: string
  amount?: number
  description: string
}

export class Supplier360Service {
  /**
   * Complete unified Supplier 360 profile.
   */
  static async getSupplier360(businessId: string, supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
      include: {
        assignedUser: { select: { id: true, fullName: true, email: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    // Parallel fetch operational records
    const [
      purchases,
      payments,
      purchaseOrders,
      goodsReceipts,
      purchaseReturns,
      debitNotes,
      activities,
      tasks,
    ] = await Promise.all([
      prisma.purchase.findMany({
        where: { businessId, supplierId, status: { notIn: ['voided', 'cancelled'] } },
        include: { items: true },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.payment.findMany({
        where: { businessId, supplierId, type: 'outgoing', status: 'posted' },
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.purchaseOrder.findMany({
        where: { businessId, supplierId },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.goodsReceipt.findMany({
        where: { businessId, supplierId },
        orderBy: { receiptDate: 'desc' },
      }),
      prisma.purchaseReturn.findMany({
        where: { businessId, supplierId },
        orderBy: { returnDate: 'desc' },
      }),
      prisma.creditDebitNote.findMany({
        where: { businessId, supplierId, type: 'debit_note' },
        orderBy: { noteDate: 'desc' },
      }),
      prisma.crmActivity.findMany({
        where: { businessId, supplierId },
        include: { user: true, supplierContact: true },
        orderBy: { activityDate: 'desc' },
        take: 30,
      }),
      prisma.crmTask.findMany({
        where: { businessId, supplierId },
        include: { assignedTo: true },
        orderBy: { dueDate: 'asc' },
        take: 30,
      }),
    ])

    // Performance indicators calculation
    const performance = await this.getSupplierPerformance(businessId, supplierId)

    const totalPurchasesVolume = purchases.reduce(
      (acc, p) => (p.status !== 'draft' ? acc.plus(new Decimal(p.totalAmount)) : acc),
      new Decimal(0)
    )
    const totalPaymentsPaid = payments.reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0))
    const totalReturnsValue = purchaseReturns.reduce((acc, r) => acc.plus(new Decimal(r.totalAmount || 0)), new Decimal(0))

    const openPosCount = purchaseOrders.filter((po) => po.status === 'confirmed' || po.status === 'processing').length
    const pendingReceiptsCount = goodsReceipts.filter((gr) => gr.status === 'draft').length

    // Build timeline
    const timeline: SupplierTimelineItem[] = []

    purchaseOrders.forEach((po) => {
      timeline.push({
        id: po.id,
        type: 'purchase_order',
        documentNumber: po.orderNumber,
        date: po.orderDate,
        status: po.status,
        amount: Number(po.grandTotal),
        description: `Purchase Order ${po.orderNumber} (${po.status})`,
      })
    })

    goodsReceipts.forEach((gr) => {
      timeline.push({
        id: gr.id,
        type: 'goods_receipt',
        documentNumber: gr.receiptNumber,
        date: gr.receiptDate,
        status: gr.status,
        description: `Goods Receipt ${gr.receiptNumber} (${gr.status})`,
      })
    })

    purchases.forEach((b) => {
      timeline.push({
        id: b.id,
        type: 'bill',
        documentNumber: b.purchaseNumber,
        date: b.purchaseDate,
        status: b.status,
        amount: Number(b.totalAmount),
        description: `Purchase Bill ${b.purchaseNumber} (${b.status}) - Bal: $${Number(b.balanceDue).toFixed(2)}`,
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
        description: `Payment Out ${pay.paymentNumber} via ${pay.method}`,
      })
    })

    purchaseReturns.forEach((ret) => {
      timeline.push({
        id: ret.id,
        type: 'return',
        documentNumber: ret.returnNumber,
        date: ret.returnDate,
        status: ret.status,
        amount: Number(ret.totalAmount || 0),
        description: `Purchase Return ${ret.returnNumber}`,
      })
    })

    debitNotes.forEach((dn) => {
      timeline.push({
        id: dn.id,
        type: 'debit_note',
        documentNumber: dn.noteNumber,
        date: dn.noteDate,
        status: dn.status,
        amount: Number(dn.totalAmount),
        description: `Debit Note ${dn.noteNumber}`,
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

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        companyName: supplier.companyName,
        email: supplier.email,
        phone: supplier.phone,
        mobile: supplier.mobile,
        whatsapp: supplier.whatsapp,
        website: supplier.website,
        address: supplier.address,
        billingAddress: supplier.billingAddress,
        shippingAddress: supplier.shippingAddress,
        city: supplier.city,
        state: supplier.state,
        postalCode: supplier.postalCode,
        country: supplier.country,
        taxNumber: supplier.taxNumber,
        category: supplier.category,
        industry: supplier.industry,
        region: supplier.region,
        tags: supplier.tags,
        assignedUser: supplier.assignedUser,
        paymentTerms: supplier.paymentTerms,
        rating: supplier.rating ? Number(supplier.rating) : null,
        currentBalance: Number(supplier.balance),
        notes: supplier.notes,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
      },
      contacts: supplier.contacts,
      performance,
      financialSummary: {
        currentBalance: Number(supplier.balance),
        totalPurchasesVolume: totalPurchasesVolume.toNumber(),
        totalPaymentsPaid: totalPaymentsPaid.toNumber(),
        totalReturnsValue: totalReturnsValue.toNumber(),
        billsCount: purchases.length,
        paymentsCount: payments.length,
        openPosCount,
        pendingReceiptsCount,
      },
      activities,
      tasks,
      timeline: timeline.slice(0, 50),
    }
  }

  /**
   * Calculate Measurable Supplier Performance Indicators.
   */
  static async getSupplierPerformance(businessId: string, supplierId: string) {
    const [purchases, purchaseOrders, goodsReceipts, returns, debitNotes] = await Promise.all([
      prisma.purchase.findMany({
        where: { businessId, supplierId, status: { notIn: ['draft', 'voided', 'cancelled'] } },
        include: { items: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { businessId, supplierId },
        include: { items: true },
      }),
      prisma.goodsReceipt.findMany({
        where: { businessId, supplierId, status: 'received' },
        include: { items: true },
      }),
      prisma.purchaseReturn.findMany({
        where: { businessId, supplierId, status: { notIn: ['draft', 'cancelled'] } },
      }),
      prisma.creditDebitNote.findMany({
        where: { businessId, supplierId, type: 'debit_note' },
      }),
    ])

    const poMap = new Map(purchaseOrders.map((po) => [po.id, po]))

    const totalPurchaseVolume = purchases.reduce(
      (acc, p) => acc.plus(new Decimal(p.totalAmount)),
      new Decimal(0)
    )

    // Calculate Lead Time & Late Receipts
    let totalLeadTimeDays = 0
    let leadTimeObservations = 0
    let lateReceiptsCount = 0

    for (const gr of goodsReceipts) {
      const po = gr.purchaseOrderId ? poMap.get(gr.purchaseOrderId) : null
      if (po) {
        const poDate = new Date(po.orderDate).getTime()
        const grDate = new Date(gr.receiptDate).getTime()
        const diffDays = Math.max(0, Math.floor((grDate - poDate) / (1000 * 60 * 60 * 24)))

        totalLeadTimeDays += diffDays
        leadTimeObservations++

        if (diffDays > 14) {
          lateReceiptsCount++
        }
      }
    }

    const averageLeadTimeDays = leadTimeObservations > 0
      ? Math.round((totalLeadTimeDays / leadTimeObservations) * 10) / 10
      : null

    const lateReceiptRatePercent = leadTimeObservations > 0
      ? Math.round((lateReceiptsCount / leadTimeObservations) * 100)
      : 0

    // Fill rate % (Received items vs ordered items across completed POs)
    let totalOrderedQty = new Decimal(0)
    let totalReceivedQty = new Decimal(0)

    for (const po of purchaseOrders) {
      for (const item of po.items) {
        totalOrderedQty = totalOrderedQty.plus(new Decimal(item.quantity))
      }
    }

    for (const gr of goodsReceipts) {
      for (const item of gr.items) {
        totalReceivedQty = totalReceivedQty.plus(new Decimal(item.receivedQuantity))
      }
    }

    const fillRatePercent = totalOrderedQty.gt(0)
      ? Math.min(100, Math.round(totalReceivedQty.div(totalOrderedQty).mul(100).toNumber()))
      : 100

    // Return Rate %
    const totalReturnsValue = returns.reduce(
      (acc, r) => acc.plus(new Decimal(r.totalAmount || 0)),
      new Decimal(0)
    )

    const returnRatePercent = totalPurchaseVolume.gt(0)
      ? Math.round(totalReturnsValue.div(totalPurchaseVolume).mul(100).toNumber() * 10) / 10
      : 0

    // Price history tracking (most recently purchased products from this supplier)
    const priceHistoryMap: Record<string, { productId: string; productName: string; prices: Array<{ date: Date; unitPrice: number }> }> = {}

    for (const p of purchases) {
      for (const item of p.items) {
        if (item.productId) {
          if (!priceHistoryMap[item.productId]) {
            priceHistoryMap[item.productId] = {
              productId: item.productId,
              productName: item.description,
              prices: [],
            }
          }
          priceHistoryMap[item.productId].prices.push({
            date: p.purchaseDate,
            unitPrice: Number(item.unitPrice),
          })
        }
      }
    }

    // Quality incidents count = returns + debit notes
    const qualityIncidentsCount = returns.length + debitNotes.length

    return {
      totalPurchaseVolume: totalPurchaseVolume.toNumber(),
      purchaseOrdersCount: purchaseOrders.length,
      goodsReceiptsCount: goodsReceipts.length,
      averageLeadTimeDays,
      lateReceiptsCount,
      lateReceiptRatePercent,
      fillRatePercent,
      returnRatePercent,
      returnsCount: returns.length,
      totalReturnsValue: totalReturnsValue.toNumber(),
      debitNotesCount: debitNotes.length,
      qualityIncidentsCount,
      priceHistory: Object.values(priceHistoryMap).slice(0, 10),
    }
  }
}
