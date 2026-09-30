// =============================================================
// Purchase Request Service — Internal Procurement Requisition
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createPurchaseRequestSchema,
  CreatePurchaseRequestInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { PurchaseOrderStatus } from '@prisma/client'

export class PurchaseRequestService {
  /**
   * Create an internal purchase request.
   * Operational document: Does NOT create GL entries or inventory movements.
   */
  static async createRequest(input: CreatePurchaseRequestInput) {
    const validated = createPurchaseRequestSchema.parse(input)
    const { businessId, warehouseId, requestDate, requiredDate, department, notes, lines, userId } = validated

    const requestNumber =
      validated.requestNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'purchase_request'))

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        businessId,
        warehouseId: warehouseId || null,
        requestNumber,
        requestDate,
        requiredDate: requiredDate || null,
        department: department || null,
        status: 'draft',
        notes: notes || null,
        createdBy: userId,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            quantity: new Decimal(line.quantity),
            estimatedUnitPrice: line.estimatedUnitPrice ? new Decimal(line.estimatedUnitPrice) : null,
            notes: line.notes || null,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        warehouse: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_request',
      entityId: purchaseRequest.id,
      action: 'create',
      changes: { requestNumber, department },
    })

    return purchaseRequest
  }

  /**
   * Submit draft purchase request for approval.
   */
  static async submitRequest(businessId: string, requestId: string, userId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, businessId },
    })
    if (!pr) throw new TenantAccessDeniedError('Purchase Request')

    if (pr.status !== 'draft') {
      throw new ValidationError(`Cannot submit purchase request in ${pr.status} status`)
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: { status: 'submitted', updatedBy: userId },
      include: { items: { include: { product: true } } },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_request',
      entityId: requestId,
      action: 'submit',
      changes: { status: 'submitted' },
    })

    return updated
  }

  /**
   * Approve submitted purchase request.
   */
  static async approveRequest(businessId: string, requestId: string, userId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, businessId },
    })
    if (!pr) throw new TenantAccessDeniedError('Purchase Request')

    if (pr.status === 'approved') {
      return pr
    }

    if (pr.status === 'cancelled' || pr.status === 'rejected') {
      throw new ValidationError(`Cannot approve purchase request in ${pr.status} status`)
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: { status: 'approved', updatedBy: userId },
      include: { items: { include: { product: true } } },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_request',
      entityId: requestId,
      action: 'approve',
      changes: { status: 'approved' },
    })

    return updated
  }

  /**
   * Reject purchase request.
   */
  static async rejectRequest(businessId: string, requestId: string, reason: string, userId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, businessId },
    })
    if (!pr) throw new TenantAccessDeniedError('Purchase Request')

    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        notes: pr.notes ? `${pr.notes} [Rejected: ${reason}]` : `Rejected: ${reason}`,
        updatedBy: userId,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_request',
      entityId: requestId,
      action: 'reject',
      changes: { status: 'rejected', reason },
    })

    return updated
  }

  /**
   * Convert Approved Purchase Request into a Purchase Order for a specific supplier.
   * Prevents duplicate conversion.
   */
  static async convertToPurchaseOrder(
    businessId: string,
    requestId: string,
    supplierId: string,
    userId: string,
    options?: { currency?: string; exchangeRate?: number }
  ) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, businessId },
      include: { items: { include: { product: true } } },
    })
    if (!pr) throw new TenantAccessDeniedError('Purchase Request')

    if (pr.convertedToOrderId) {
      throw new ValidationError(`Purchase request ${pr.requestNumber} has already been converted to a Purchase Order`)
    }

    if (pr.status !== 'approved') {
      throw new ValidationError(`Only approved purchase requests can be converted. Current status: ${pr.status}`)
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    const orderNumber = await DocumentNumberingService.generateNumber(businessId, 'purchase_order')

    return prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0)
      const poItems = pr.items.map((item, idx) => {
        const qty = new Decimal(item.quantity)
        const unitCost = item.estimatedUnitPrice
          ? new Decimal(item.estimatedUnitPrice)
          : item.product.costPrice
          ? new Decimal(item.product.costPrice)
          : new Decimal(0)
        const lineTotal = qty.mul(unitCost)
        subtotal = subtotal.plus(lineTotal)

        return {
          productId: item.productId,
          warehouseId: pr.warehouseId,
          description: item.product.name,
          quantity: qty,
          unitPrice: unitCost,
          taxRate: new Decimal(0),
          taxAmount: new Decimal(0),
          lineTotal: lineTotal,
          lineOrder: idx + 1,
        }
      })

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          businessId,
          supplierId,
          warehouseId: pr.warehouseId,
          orderNumber,
          orderDate: new Date(),
          currency: options?.currency || supplier.currency || 'USD',
          exchangeRate: new Decimal(options?.exchangeRate || 1),
          subtotal,
          discountTotal: new Decimal(0),
          taxTotal: new Decimal(0),
          grandTotal: subtotal,
          status: PurchaseOrderStatus.confirmed,
          notes: pr.notes ? `Converted from PR ${pr.requestNumber}. ${pr.notes}` : `Converted from PR ${pr.requestNumber}`,
          createdBy: userId,
          items: {
            create: poItems,
          },
        },
        include: { items: true, supplier: true },
      })

      // Mark PR as converted
      await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          convertedToOrderId: purchaseOrder.id,
          updatedBy: userId,
        },
      })

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'purchase_request',
          entityId: requestId,
          action: 'convert_to_purchase_order',
          changes: { purchaseOrderId: purchaseOrder.id, orderNumber },
        },
        tx
      )

      return purchaseOrder
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * Get single Purchase Request by ID.
   */
  static async getById(businessId: string, requestId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, businessId },
      include: {
        warehouse: true,
        items: { include: { product: true } },
      },
    })
    if (!pr) throw new TenantAccessDeniedError('Purchase Request')
    return pr
  }

  /**
   * List purchase requests.
   */
  static async list(businessId: string, filter?: { status?: string; warehouseId?: string }) {
    return prisma.purchaseRequest.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      },
      include: { warehouse: true, items: { include: { product: true } } },
      orderBy: { requestDate: 'desc' },
    })
  }
}
