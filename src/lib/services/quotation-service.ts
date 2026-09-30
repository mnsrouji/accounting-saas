// =============================================================
// Quotation Service — Sales Quotations & Document Lifecycle
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createQuotationSchema,
  CreateQuotationInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export class QuotationService {
  /**
   * Create a new sales quotation (Draft or Sent).
   * Operational document: Does NOT create GL entries or inventory movements.
   */
  static async createQuotation(input: CreateQuotationInput) {
    const validated = createQuotationSchema.parse(input)
    const { businessId, customerId, validUntil, currency, exchangeRate, notes, terms, lines, userId } = validated

    // Verify customer exists and belongs to business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const quotationNumber =
      validated.quotationNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'quotation'))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)
    let discountTotal = new Decimal(0)

    const quotationItems = lines.map((line, idx) => {
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

    const quotation = await prisma.quotation.create({
      data: {
        businessId,
        customerId,
        quotationNumber,
        quotationDate: validated.quotationDate,
        validUntil: validUntil || null,
        currency,
        exchangeRate: new Decimal(exchangeRate || 1),
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        status: 'draft',
        notes: notes || null,
        terms: terms || null,
        createdBy: userId,
        items: {
          create: quotationItems,
        },
      },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'quotation',
      entityId: quotation.id,
      action: 'create',
      changes: { quotationNumber, grandTotal: grandTotal.toNumber(), customerId },
    })

    return quotation
  }

  /**
   * Update quotation status (draft, sent, accepted, rejected, expired, cancelled).
   */
  static async updateStatus(
    businessId: string,
    quotationId: string,
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled',
    userId: string
  ) {
    const existing = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('Quotation')

    if (existing.status === 'cancelled') {
      throw new ValidationError('Cannot update a cancelled quotation')
    }

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: { status, updatedBy: userId },
      include: { customer: true, items: true },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'quotation',
      entityId: quotationId,
      action: 'status_change',
      changes: { previousStatus: existing.status, newStatus: status },
    })

    return updated
  }

  /**
   * Convert accepted quotation into a Sales Order.
   * Prevents duplicate conversion.
   */
  static async convertToSalesOrder(businessId: string, quotationId: string, userId: string) {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId },
      include: { items: true, customer: true },
    })
    if (!quotation) throw new TenantAccessDeniedError('Quotation')

    if (quotation.convertedToOrderId) {
      throw new ValidationError(`Quotation ${quotation.quotationNumber} has already been converted to Sales Order`)
    }

    if (quotation.status === 'rejected' || quotation.status === 'cancelled' || quotation.status === 'expired') {
      throw new ValidationError(`Cannot convert quotation with status: ${quotation.status}`)
    }

    const orderNumber = await DocumentNumberingService.generateNumber(businessId, 'sales_order')

    return prisma.$transaction(
      async (tx) => {
        // 1. Create the Sales Order
        const salesOrder = await tx.salesOrder.create({
          data: {
            businessId,
            customerId: quotation.customerId,
            orderNumber,
            orderDate: new Date(),
            currency: quotation.currency,
            exchangeRate: quotation.exchangeRate,
            subtotal: quotation.subtotal,
            discountTotal: quotation.discountTotal,
            taxTotal: quotation.taxTotal,
            grandTotal: quotation.grandTotal,
            status: 'confirmed',
            notes: quotation.notes
              ? `Converted from Quotation ${quotation.quotationNumber}. ${quotation.notes}`
              : `Converted from Quotation ${quotation.quotationNumber}`,
            createdBy: userId,
            items: {
              create: quotation.items.map((item, idx) => ({
                productId: item.productId,
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

        // 2. Mark quotation as accepted & converted
        await tx.quotation.update({
          where: { id: quotationId },
          data: {
            status: 'accepted',
            convertedToOrderId: salesOrder.id,
            updatedBy: userId,
          },
        })

        // 3. Audit trail
        await AuditService.log(
          {
            businessId,
            userId,
            entityType: 'quotation',
            entityId: quotationId,
            action: 'convert_to_sales_order',
            changes: { salesOrderId: salesOrder.id, salesOrderNumber: orderNumber },
          },
          tx
        )

        return salesOrder
      },
      { maxWait: 15000, timeout: 30000 }
    )
  }

  /**
   * Get single quotation with complete details and conversion traceability.
   */
  static async getById(businessId: string, quotationId: string) {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    })
    if (!quotation) throw new TenantAccessDeniedError('Quotation')
    return quotation
  }

  /**
   * List quotations for a business with optional status filter.
   */
  static async list(businessId: string, filter?: { status?: string; customerId?: string }) {
    return prisma.quotation.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
      },
      include: { customer: true },
      orderBy: { quotationDate: 'desc' },
    })
  }
}
