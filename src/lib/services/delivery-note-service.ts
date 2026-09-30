// =============================================================
// Delivery Note Service — Stock Dispatch & Fulfillment Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createDeliveryNoteSchema,
  CreateDeliveryNoteInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { StockReservationService } from './stock-reservation-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError, InsufficientStockError } from '@/lib/errors/accounting-error'
import { SalesOrderStatus } from '@prisma/client'

export class DeliveryNoteService {
  /**
   * Create a direct or order-linked Delivery Note in draft status.
   */
  static async createDeliveryNote(input: CreateDeliveryNoteInput) {
    const validated = createDeliveryNoteSchema.parse(input)
    const { businessId, customerId, salesOrderId, warehouseId, deliveryDate, trackingNumber, notes, lines, userId } = validated

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    let effectiveWarehouseId = warehouseId
    if (!effectiveWarehouseId) {
      const defaultWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      effectiveWarehouseId = defaultWh?.id
    }

    const deliveryNumber =
      validated.deliveryNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'delivery_note'))

    const deliveryNote = await prisma.deliveryNote.create({
      data: {
        businessId,
        customerId,
        salesOrderId: salesOrderId || null,
        warehouseId: effectiveWarehouseId || null,
        deliveryNumber,
        deliveryDate,
        trackingNumber: trackingNumber || null,
        status: 'draft',
        notes: notes || null,
        createdBy: userId,
        items: {
          create: lines.map((l) => ({
            salesOrderItemId: l.salesOrderItemId || null,
            productId: l.productId,
            warehouseId: l.warehouseId || effectiveWarehouseId || null,
            orderedQuantity: new Decimal(l.orderedQuantity || 0),
            deliveredQuantity: new Decimal(l.deliveredQuantity),
            notes: l.notes || null,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
        warehouse: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'delivery_note',
      entityId: deliveryNote.id,
      action: 'create',
      changes: { deliveryNumber, customerId, salesOrderId },
    })

    return deliveryNote
  }

  /**
   * Confirm Delivery Note:
   * 1. Validates available inventory per item/warehouse.
   * 2. Reduces physical stock using existing InventoryService.issueStock.
   * 3. Records inventory movements.
   * 4. Updates linked Sales Order fulfillment status.
   */
  static async confirmDelivery(businessId: string, deliveryNoteId: string, userId: string) {
    const deliveryNote = await prisma.deliveryNote.findFirst({
      where: { id: deliveryNoteId, businessId },
      include: {
        items: { include: { product: true } },
      },
    })
    if (!deliveryNote) throw new TenantAccessDeniedError('Delivery Note')

    if (deliveryNote.status !== 'draft') {
      throw new ValidationError(`Delivery note ${deliveryNote.deliveryNumber} is already ${deliveryNote.status}`)
    }

    // Default warehouse fallback
    let defaultWarehouseId: string | null = deliveryNote.warehouseId || null
    if (!defaultWarehouseId) {
      const defWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      defaultWarehouseId = defWh?.id || null
    }

    return prisma.$transaction(async (tx) => {
      // 1. Validate & Deduct Inventory for each line
      for (const item of deliveryNote.items) {
        const whId = item.warehouseId || defaultWarehouseId
        if (!whId) {
          throw new ValidationError(`Warehouse required for item ${item.product.name}`)
        }

        const qtyToIssue = new Decimal(item.deliveredQuantity)

        // Issue stock via InventoryService
        const { currentAvgCost } = await InventoryService.issueStock(
          businessId,
          item.productId,
          whId,
          qtyToIssue,
          tx
        )

        // Consume stock reservation if any active reservation exists for this item/order
        await StockReservationService.consumeReservation(
          businessId,
          {
            salesOrderId: deliveryNote.salesOrderId || undefined,
            salesOrderItemId: item.salesOrderItemId || undefined,
            productId: item.productId,
            warehouseId: whId,
            quantity: qtyToIssue,
          },
          tx
        )

        // Record Inventory Movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: whId,
            movementType: 'sale',
            quantity: qtyToIssue.negated(),
            unitCost: currentAvgCost,
            totalCost: qtyToIssue.mul(currentAvgCost),
            referenceType: 'delivery_note',
            referenceId: deliveryNote.id,
            createdBy: userId,
          },
        })
      }

      // 2. Mark Delivery Note as confirmed
      const updatedNote = await tx.deliveryNote.update({
        where: { id: deliveryNoteId },
        data: {
          status: 'confirmed',
          updatedBy: userId,
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          warehouse: true,
        },
      })

      // 3. If linked to a Sales Order, update Sales Order fulfillment status
      if (deliveryNote.salesOrderId) {
        const so = await tx.salesOrder.findUnique({
          where: { id: deliveryNote.salesOrderId },
          include: { items: true },
        })

        if (so) {
          // Find all confirmed delivery notes for this order
          const confirmedNotes = await tx.deliveryNote.findMany({
            where: {
              salesOrderId: so.id,
              status: { in: ['confirmed', 'delivered'] },
            },
            include: { items: true },
          })

          const deliveredMap = new Map<string, Decimal>()
          for (const cn of confirmedNotes) {
            for (const cni of cn.items) {
              if (cni.salesOrderItemId) {
                const prev = deliveredMap.get(cni.salesOrderItemId) || new Decimal(0)
                deliveredMap.set(cni.salesOrderItemId, prev.plus(new Decimal(cni.deliveredQuantity)))
              }
            }
          }

          let allFulfilled = true
          let someFulfilled = false

          for (const soItem of so.items) {
            const delivered = deliveredMap.get(soItem.id) || new Decimal(0)
            const ordered = new Decimal(soItem.quantity)
            if (delivered.gt(0)) someFulfilled = true
            if (delivered.lt(ordered)) allFulfilled = false
          }

          const newOrderStatus = allFulfilled
            ? SalesOrderStatus.fulfilled
            : someFulfilled
            ? SalesOrderStatus.processing
            : so.status

          await tx.salesOrder.update({
            where: { id: so.id },
            data: { status: newOrderStatus, updatedBy: userId },
          })
        }
      }

      // 4. Audit trail
      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'delivery_note',
          entityId: deliveryNoteId,
          action: 'confirm_delivery',
          changes: { status: 'confirmed' },
        },
        tx
      )

      return updatedNote
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * Get Delivery Note by ID with complete relationships.
   */
  static async getById(businessId: string, deliveryNoteId: string) {
    const deliveryNote = await prisma.deliveryNote.findFirst({
      where: { id: deliveryNoteId, businessId },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    })
    if (!deliveryNote) throw new TenantAccessDeniedError('Delivery Note')
    return deliveryNote
  }

  /**
   * List delivery notes for a business.
   */
  static async list(businessId: string, filter?: { status?: string; customerId?: string; salesOrderId?: string }) {
    return prisma.deliveryNote.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
        ...(filter?.salesOrderId ? { salesOrderId: filter.salesOrderId } : {}),
      },
      include: { customer: true, warehouse: true },
      orderBy: { deliveryDate: 'desc' },
    })
  }
}
