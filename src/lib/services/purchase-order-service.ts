// =============================================================
// Purchase Order Service — Procurement Lifecycle & Receiving Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createPurchaseOrderSchema,
  CreatePurchaseOrderInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { PurchaseOrderStatus, PurchaseStatus } from '@prisma/client'

export class PurchaseOrderService {
  /**
   * Create a new Purchase Order.
   * Operational document: Does NOT create AP liability or alter inventory balances.
   */
  static async createOrder(input: CreatePurchaseOrderInput) {
    const validated = createPurchaseOrderSchema.parse(input)
    const { businessId, supplierId, warehouseId, orderDate, currency, exchangeRate, notes, lines, userId } = validated

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    const orderNumber =
      validated.orderNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'purchase_order'))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)

    const orderItems = lines.map((line, idx) => {
      const qty = new Decimal(line.quantity)
      const cost = new Decimal(line.unitPrice)
      const taxRatePct = new Decimal(line.taxRate || 0)

      const lineBase = qty.mul(cost)
      const lineTax = lineBase.mul(taxRatePct.div(100))
      const lineTotal = lineBase.plus(lineTax)

      subtotal = subtotal.plus(lineBase)
      taxTotal = taxTotal.plus(lineTax)

      return {
        productId: line.productId || null,
        warehouseId: line.warehouseId || warehouseId || null,
        description: line.description,
        quantity: qty,
        unitPrice: cost,
        taxRate: taxRatePct,
        taxAmount: lineTax,
        lineTotal: lineTotal,
        lineOrder: idx + 1,
      }
    })

    const grandTotal = subtotal.plus(taxTotal)

    const order = await prisma.purchaseOrder.create({
      data: {
        businessId,
        supplierId,
        warehouseId: warehouseId || null,
        orderNumber,
        orderDate,
        currency,
        exchangeRate: new Decimal(exchangeRate || 1),
        subtotal,
        discountTotal: new Decimal(0),
        taxTotal,
        grandTotal,
        status: PurchaseOrderStatus.confirmed,
        notes: notes || null,
        createdBy: userId,
        items: {
          create: orderItems,
        },
      },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: { product: true },
        },
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_order',
      entityId: order.id,
      action: 'create',
      changes: { orderNumber, grandTotal: grandTotal.toNumber(), supplierId },
    })

    return order
  }

  /**
   * Get receiving summary and unreceived quantities for each line on a Purchase Order.
   */
  static async getOrderReceivingSummary(businessId: string, orderId: string) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, businessId },
      include: {
        items: { include: { product: true } },
      },
    })
    if (!order) throw new TenantAccessDeniedError('Purchase Order')

    // Find all goods receipts linked to this purchase order
    const receipts = await prisma.goodsReceipt.findMany({
      where: { purchaseOrderId: orderId, businessId, status: { not: 'cancelled' } },
      include: { items: true },
    })

    const receivedMap = new Map<string, Decimal>()
    for (const gr of receipts) {
      for (const item of gr.items) {
        if (item.purchaseOrderItemId) {
          const prev = receivedMap.get(item.purchaseOrderItemId) || new Decimal(0)
          receivedMap.set(item.purchaseOrderItemId, prev.plus(new Decimal(item.receivedQuantity)))
        }
      }
    }

    let allFullyReceived = true
    let someReceived = false

    const itemsSummary = order.items.map((item) => {
      const orderedQty = new Decimal(item.quantity)
      const receivedQty = receivedMap.get(item.id) || new Decimal(0)
      const remainingQty = Decimal.max(0, orderedQty.minus(receivedQty))

      if (receivedQty.gt(0)) someReceived = true
      if (remainingQty.gt(0)) allFullyReceived = false

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || item.description,
        description: item.description,
        orderedQuantity: orderedQty.toNumber(),
        receivedQuantity: receivedQty.toNumber(),
        remainingQuantity: remainingQty.toNumber(),
        unitCost: Number(item.unitPrice),
      }
    })

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      items: itemsSummary,
      isFullyReceived: allFullyReceived && itemsSummary.length > 0,
      isPartiallyReceived: someReceived && !allFullyReceived,
    }
  }

  /**
   * Convert Purchase Order (or partial lines) to a Goods Receipt.
   * Enforces remaining quantity constraints and tracks partial receiving.
   */
  static async convertToGoodsReceipt(
    businessId: string,
    orderId: string,
    receiptLines: { purchaseOrderItemId: string; quantity: number; unitCost?: number; warehouseId?: string }[],
    userId: string,
    options?: { receiptDate?: Date; supplierDeliveryNote?: string; notes?: string }
  ) {
    const summary = await this.getOrderReceivingSummary(businessId, orderId)
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, businessId },
    })
    if (!order) throw new TenantAccessDeniedError('Purchase Order')

    if (order.status === PurchaseOrderStatus.cancelled) {
      throw new ValidationError('Cannot receive items for cancelled purchase order')
    }

    const receiptNumber = await DocumentNumberingService.generateNumber(businessId, 'goods_receipt')

    return prisma.$transaction(async (tx) => {
      const createdItems: {
        purchaseOrderItemId: string
        productId: string
        warehouseId?: string | null
        orderedQuantity: Decimal
        receivedQuantity: Decimal
        unitCost: Decimal
        notes?: string
      }[] = []

      for (const line of receiptLines) {
        const itemSummary = summary.items.find((i) => i.id === line.purchaseOrderItemId)
        if (!itemSummary) {
          throw new ValidationError(`Order item ${line.purchaseOrderItemId} not found on this purchase order`)
        }

        const qtyToReceive = new Decimal(line.quantity)
        if (qtyToReceive.lte(0)) {
          throw new ValidationError(`Quantity to receive must be positive for ${itemSummary.productName}`)
        }

        if (qtyToReceive.gt(itemSummary.remainingQuantity)) {
          throw new ValidationError(
            `Cannot receive ${qtyToReceive.toNumber()} units of ${itemSummary.productName}. Remaining unreceived quantity is ${itemSummary.remainingQuantity}.`
          )
        }

        createdItems.push({
          purchaseOrderItemId: line.purchaseOrderItemId,
          productId: itemSummary.productId!,
          warehouseId: line.warehouseId || order.warehouseId || null,
          orderedQuantity: new Decimal(itemSummary.orderedQuantity),
          receivedQuantity: qtyToReceive,
          unitCost: line.unitCost !== undefined ? new Decimal(line.unitCost) : new Decimal(itemSummary.unitCost),
          notes: options?.notes,
        })
      }

      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          businessId,
          purchaseOrderId: orderId,
          supplierId: order.supplierId,
          warehouseId: order.warehouseId,
          receiptNumber,
          receiptDate: options?.receiptDate || new Date(),
          supplierDeliveryNote: options?.supplierDeliveryNote || null,
          status: 'draft',
          notes: options?.notes || `Received from PO ${order.orderNumber}`,
          createdBy: userId,
          items: {
            create: createdItems,
          },
        },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
        },
      })

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'goods_receipt',
          entityId: goodsReceipt.id,
          action: 'create_from_purchase_order',
          changes: { purchaseOrderId: orderId, receiptNumber },
        },
        tx
      )

      return goodsReceipt
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * Convert Purchase Order to Purchase Bill (Purchase Invoice).
   */
  static async convertToPurchaseBill(businessId: string, orderId: string, userId: string) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, businessId },
      include: { items: true, supplier: true },
    })
    if (!order) throw new TenantAccessDeniedError('Purchase Order')

    if (order.status === PurchaseOrderStatus.cancelled) {
      throw new ValidationError('Cannot bill a cancelled purchase order')
    }

    const purchaseNumber = await DocumentNumberingService.generateNumber(businessId, 'purchase_invoice')

    return prisma.$transaction(
      async (tx) => {
        const bill = await tx.purchase.create({
          data: {
            businessId,
            supplierId: order.supplierId,
            purchaseOrderId: order.id,
            purchaseNumber,
            purchaseDate: new Date(),
            dueDate: new Date(Date.now() + (order.supplier?.paymentTerms || 30) * 86400000),
            currencyCode: order.currency,
            exchangeRate: order.exchangeRate,
            subtotal: order.subtotal,
            discountAmount: order.discountTotal,
            taxAmount: order.taxTotal,
            totalAmount: order.grandTotal,
            paidAmount: new Decimal(0),
            balanceDue: order.grandTotal,
            baseSubtotal: order.subtotal.mul(order.exchangeRate),
            baseTaxAmount: order.taxTotal.mul(order.exchangeRate),
            baseTotalAmount: order.grandTotal.mul(order.exchangeRate),
            status: PurchaseStatus.draft,
            notes: `Generated from Purchase Order ${order.orderNumber}. ${order.notes || ''}`,
            createdBy: userId,
            items: {
              create: order.items.map((item, idx) => ({
                productId: item.productId,
                warehouseId: item.warehouseId || order.warehouseId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
                lineOrder: idx + 1,
              })),
            },
          },
          include: { items: true, supplier: true },
        })

        await AuditService.log(
          {
            businessId,
            userId,
            entityType: 'purchase',
            entityId: bill.id,
            action: 'convert_from_purchase_order',
            changes: { purchaseOrderId: orderId, purchaseNumber },
          },
          tx
        )

        return bill
      },
      { maxWait: 15000, timeout: 30000 }
    )
  }

  /**
   * Get traceability chain from Purchase Request -> Purchase Order -> Goods Receipts -> Bills -> Payments.
   */
  static async getTraceabilityChain(businessId: string, orderId: string) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, businessId },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    })
    if (!order) throw new TenantAccessDeniedError('Purchase Order')

    // Find source PR
    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { businessId, convertedToOrderId: orderId },
    })

    // Find downstream Goods Receipts
    const goodsReceipts = await prisma.goodsReceipt.findMany({
      where: { businessId, purchaseOrderId: orderId },
      include: { items: { include: { product: true } } },
      orderBy: { receiptDate: 'asc' },
    })

    // Find downstream Purchase Bills
    const purchaseBills = await prisma.purchase.findMany({
      where: { businessId, purchaseOrderId: orderId },
      include: {
        payments: true,
        paymentAllocations: {
          include: { payment: true },
        },
      },
      orderBy: { purchaseDate: 'asc' },
    })

    return {
      order,
      sourcePurchaseRequest: purchaseRequest,
      goodsReceipts,
      purchaseBills,
    }
  }

  /**
   * List purchase orders.
   */
  static async list(businessId: string, filter?: { status?: PurchaseOrderStatus; supplierId?: string }) {
    return prisma.purchaseOrder.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.supplierId ? { supplierId: filter.supplierId } : {}),
      },
      include: { supplier: true, warehouse: true },
      orderBy: { orderDate: 'desc' },
    })
  }
}
