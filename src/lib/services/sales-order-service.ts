// =============================================================
// Sales Order Service — Order Lifecycle & Fulfillment Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createSalesOrderSchema,
  CreateSalesOrderInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { SalesOrderStatus } from '@prisma/client'

export class SalesOrderService {
  static async createSalesOrder(input: CreateSalesOrderInput) {
    return this.createOrder(input)
  }

  /**
   * Create a new Sales Order.
   * Operational document: Does NOT recognize revenue or post GL entries.
   */
  static async createOrder(input: CreateSalesOrderInput) {
    const validated = createSalesOrderSchema.parse(input)
    const { businessId, customerId, warehouseId, orderDate, currency, exchangeRate, notes, lines, userId } = validated

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const orderNumber =
      validated.orderNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'sales_order'))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)
    let discountTotal = new Decimal(0)

    const orderItems = lines.map((line, idx) => {
      const qty = new Decimal(line.quantity)
      const price = new Decimal(line.unitPrice)
      const discountPct = new Decimal(line.discount || 0)
      const taxRatePct = new Decimal(line.taxRate || 0)

      const lineBase = qty.mul(price)
      const lineDiscount = lineBase.mul(discountPct.div(100))
      const lineAfterDiscount = lineBase.minus(lineDiscount)
      const lineTax = lineAfterDiscount.mul(taxRatePct.div(100))
      const lineTotal = lineAfterDiscount.plus(lineTax)

      subtotal = subtotal.plus(lineAfterDiscount)
      discountTotal = discountTotal.plus(lineDiscount)
      taxTotal = taxTotal.plus(lineTax)

      return {
        productId: line.productId || null,
        warehouseId: line.warehouseId || warehouseId || null,
        description: line.description,
        quantity: qty,
        unitPrice: price,
        discount: discountPct,
        taxRate: taxRatePct,
        taxAmount: lineTax,
        lineTotal: lineTotal,
        lineOrder: idx + 1,
      }
    })

    const grandTotal = subtotal.plus(taxTotal)

    const order = await prisma.salesOrder.create({
      data: {
        businessId,
        customerId,
        warehouseId: warehouseId || null,
        orderNumber,
        orderDate,
        currency,
        exchangeRate: new Decimal(exchangeRate || 1),
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        status: SalesOrderStatus.confirmed,
        notes: notes || null,
        createdBy: userId,
        items: {
          create: orderItems,
        },
      },
      include: {
        customer: true,
        warehouse: true,
        items: {
          include: { product: true },
        },
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'sales_order',
      entityId: order.id,
      action: 'create',
      changes: { orderNumber, grandTotal: grandTotal.toNumber(), customerId },
    })

    return order
  }

  /**
   * Get Sales Order fulfillment status and remaining quantities for each line.
   */
  static async getOrderFulfillmentSummary(businessId: string, orderId: string) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, businessId },
      include: {
        items: {
          include: { product: true },
        },
      },
    })
    if (!order) throw new TenantAccessDeniedError('Sales Order')

    // Find all delivery notes linked to this sales order
    const deliveryNotes = await prisma.deliveryNote.findMany({
      where: { salesOrderId: orderId, businessId, status: { not: 'cancelled' } },
      include: { items: true },
    })

    // Sum delivered quantities per salesOrderItemId
    const deliveredMap = new Map<string, Decimal>()
    for (const dn of deliveryNotes) {
      for (const item of dn.items) {
        if (item.salesOrderItemId) {
          const prev = deliveredMap.get(item.salesOrderItemId) || new Decimal(0)
          deliveredMap.set(item.salesOrderItemId, prev.plus(new Decimal(item.deliveredQuantity)))
        }
      }
    }

    let allFullyDelivered = true
    let someDelivered = false

    const itemsSummary = order.items.map((item) => {
      const orderedQty = new Decimal(item.quantity)
      const deliveredQty = deliveredMap.get(item.id) || new Decimal(0)
      const remainingQty = Decimal.max(0, orderedQty.minus(deliveredQty))

      if (deliveredQty.gt(0)) someDelivered = true
      if (remainingQty.gt(0)) allFullyDelivered = false

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || item.description,
        description: item.description,
        orderedQuantity: orderedQty.toNumber(),
        deliveredQuantity: deliveredQty.toNumber(),
        remainingQuantity: remainingQty.toNumber(),
        unitPrice: Number(item.unitPrice),
      }
    })

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      items: itemsSummary,
      isFullyDelivered: allFullyDelivered && itemsSummary.length > 0,
      isPartiallyDelivered: someDelivered && !allFullyDelivered,
    }
  }

  /**
   * Convert Sales Order (or partial lines) to a Delivery Note.
   * Enforces remaining quantity constraints and tracks partial fulfillment.
   */
  static async convertToDeliveryNote(
    businessId: string,
    orderId: string,
    deliveryLines: { salesOrderItemId: string; quantity: number; warehouseId?: string }[],
    userId: string,
    options?: { deliveryDate?: Date; trackingNumber?: string; notes?: string }
  ) {
    const summary = await this.getOrderFulfillmentSummary(businessId, orderId)
    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, businessId },
    })
    if (!order) throw new TenantAccessDeniedError('Sales Order')

    if (order.status === SalesOrderStatus.cancelled) {
      throw new ValidationError('Cannot create delivery note for cancelled sales order')
    }

    const deliveryNumber = await DocumentNumberingService.generateNumber(businessId, 'delivery_note')

    return prisma.$transaction(
      async (tx) => {
        const createdItems: {
          salesOrderItemId: string
          productId: string
          warehouseId?: string | null
          orderedQuantity: Decimal
          deliveredQuantity: Decimal
          notes?: string
        }[] = []

        for (const line of deliveryLines) {
          const itemSummary = summary.items.find((i) => i.id === line.salesOrderItemId)
          if (!itemSummary) {
            throw new ValidationError(`Order item ${line.salesOrderItemId} not found on this sales order`)
          }

          const qtyToDeliver = new Decimal(line.quantity)
          if (qtyToDeliver.lte(0)) {
            throw new ValidationError(`Quantity to deliver must be positive for ${itemSummary.productName}`)
          }

          if (qtyToDeliver.gt(itemSummary.remainingQuantity)) {
            throw new ValidationError(
              `Cannot deliver ${qtyToDeliver.toNumber()} units of ${itemSummary.productName}. Remaining unfulfilled quantity is ${itemSummary.remainingQuantity}.`
            )
          }

          createdItems.push({
            salesOrderItemId: line.salesOrderItemId,
            productId: itemSummary.productId!,
            warehouseId: line.warehouseId || order.warehouseId || null,
            orderedQuantity: new Decimal(itemSummary.orderedQuantity),
            deliveredQuantity: qtyToDeliver,
            notes: options?.notes,
          })
        }

        // Create Delivery Note (in 'draft' status until explicitly confirmed)
        const deliveryNote = await tx.deliveryNote.create({
          data: {
            businessId,
            salesOrderId: orderId,
            customerId: order.customerId,
            warehouseId: order.warehouseId,
            deliveryNumber,
            deliveryDate: options?.deliveryDate || new Date(),
            trackingNumber: options?.trackingNumber || null,
            status: 'draft',
            notes: options?.notes || `Created from Sales Order ${order.orderNumber}`,
            createdBy: userId,
            items: {
              create: createdItems,
            },
          },
          include: {
            items: {
              include: { product: true },
            },
            customer: true,
          },
        })

        await AuditService.log(
          {
            businessId,
            userId,
            entityType: 'delivery_note',
            entityId: deliveryNote.id,
            action: 'create_from_sales_order',
            changes: { salesOrderId: orderId, deliveryNumber },
          },
          tx
        )

        return deliveryNote
      },
      { maxWait: 15000, timeout: 30000 }
    )
  }

  /**
   * Convert Sales Order to Sales Invoice (preserving salesOrderId for traceability).
   */
  static async convertToSalesInvoice(businessId: string, orderId: string, userId: string) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, businessId },
      include: { items: true, customer: true },
    })
    if (!order) throw new TenantAccessDeniedError('Sales Order')

    if (order.status === SalesOrderStatus.cancelled) {
      throw new ValidationError('Cannot invoice a cancelled sales order')
    }

    const invoiceNumber = await DocumentNumberingService.generateNumber(businessId, 'sales_invoice')

    return prisma.$transaction(
      async (tx) => {
        const invoice = await tx.sale.create({
          data: {
            businessId,
            customerId: order.customerId,
            salesOrderId: order.id,
            invoiceNumber,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + (order.customer?.paymentTerms || 30) * 86400000),
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
            status: 'draft',
            notes: `Generated from Sales Order ${order.orderNumber}. ${order.notes || ''}`,
            createdBy: userId,
            items: {
              create: order.items.map((item, idx) => ({
                productId: item.productId,
                warehouseId: item.warehouseId || order.warehouseId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
                lineOrder: idx + 1,
              })),
            },
          },
          include: { items: true, customer: true },
        })

        await AuditService.log(
          {
            businessId,
            userId,
            entityType: 'sale',
            entityId: invoice.id,
            action: 'convert_from_sales_order',
            changes: { salesOrderId: orderId, invoiceNumber },
          },
          tx
        )

        return invoice
      },
      { maxWait: 15000, timeout: 30000 }
    )
  }

  /**
   * Get comprehensive document chain and traceability for a Sales Order.
   */
  static async getTraceabilityChain(businessId: string, orderId: string) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
    if (!order) throw new TenantAccessDeniedError('Sales Order')

    // Find source quotation if any
    const quotation = await prisma.quotation.findFirst({
      where: { businessId, convertedToOrderId: orderId },
    })

    // Find downstream delivery notes
    const deliveryNotes = await prisma.deliveryNote.findMany({
      where: { businessId, salesOrderId: orderId },
      include: { items: { include: { product: true } } },
      orderBy: { deliveryDate: 'asc' },
    })

    // Find downstream invoices
    const salesInvoices = await prisma.sale.findMany({
      where: { businessId, salesOrderId: orderId },
      include: {
        payments: true,
        paymentAllocations: {
          include: { payment: true },
        },
      },
      orderBy: { invoiceDate: 'asc' },
    })

    return {
      order,
      sourceQuotation: quotation,
      deliveryNotes,
      salesInvoices,
    }
  }

  /**
   * List sales orders with optional filters.
   */
  static async list(businessId: string, filter?: { status?: SalesOrderStatus; customerId?: string }) {
    return prisma.salesOrder.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
      },
      include: { customer: true, warehouse: true },
      orderBy: { orderDate: 'desc' },
    })
  }
}
