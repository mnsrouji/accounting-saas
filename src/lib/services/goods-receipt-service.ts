// =============================================================
// Goods Receipt Service — Inbound Receiving & WAC Update Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createGoodsReceiptSchema,
  CreateGoodsReceiptInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { PurchaseOrderStatus } from '@prisma/client'

export class GoodsReceiptService {
  /**
   * Create a Goods Receipt in draft status.
   */
  static async createGoodsReceipt(input: CreateGoodsReceiptInput) {
    const validated = createGoodsReceiptSchema.parse(input)
    const { businessId, supplierId, purchaseOrderId, warehouseId, receiptDate, supplierDeliveryNote, notes, lines, userId } = validated

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    let effectiveWarehouseId = warehouseId
    if (!effectiveWarehouseId) {
      const defaultWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      effectiveWarehouseId = defaultWh?.id
    }

    const receiptNumber =
      validated.receiptNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'goods_receipt'))

    const goodsReceipt = await prisma.goodsReceipt.create({
      data: {
        businessId,
        supplierId,
        purchaseOrderId: purchaseOrderId || null,
        warehouseId: effectiveWarehouseId || null,
        receiptNumber,
        receiptDate,
        supplierDeliveryNote: supplierDeliveryNote || null,
        status: 'draft',
        notes: notes || null,
        createdBy: userId,
        items: {
          create: lines.map((l) => ({
            purchaseOrderItemId: l.purchaseOrderItemId || null,
            productId: l.productId,
            warehouseId: l.warehouseId || effectiveWarehouseId || null,
            orderedQuantity: new Decimal(l.orderedQuantity || 0),
            receivedQuantity: new Decimal(l.receivedQuantity),
            unitCost: new Decimal(l.unitCost || 0),
            notes: l.notes || null,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'goods_receipt',
      entityId: goodsReceipt.id,
      action: 'create',
      changes: { receiptNumber, supplierId, purchaseOrderId },
    })

    return goodsReceipt
  }

  /**
   * Confirm Goods Receipt:
   * 1. Increases stock and recalculates WAC using existing InventoryService.recalculateWAC.
   * 2. Records inventory movements.
   * 3. Updates linked Purchase Order receiving status.
   */
  static async confirmReceipt(businessId: string, receiptId: string, userId: string) {
    const goodsReceipt = await prisma.goodsReceipt.findFirst({
      where: { id: receiptId, businessId },
      include: {
        items: { include: { product: true } },
      },
    })
    if (!goodsReceipt) throw new TenantAccessDeniedError('Goods Receipt')

    if (goodsReceipt.status !== 'draft') {
      throw new ValidationError(`Goods receipt ${goodsReceipt.receiptNumber} is already ${goodsReceipt.status}`)
    }

    let defaultWarehouseId: string | null = goodsReceipt.warehouseId || null
    if (!defaultWarehouseId) {
      const defWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      defaultWarehouseId = defWh?.id || null
    }

    return prisma.$transaction(async (tx) => {
      // 1. Receive stock & update WAC for each line
      for (const item of goodsReceipt.items) {
        const whId = item.warehouseId || defaultWarehouseId
        if (!whId) {
          throw new ValidationError(`Warehouse required for item ${item.product.name}`)
        }

        const qty = new Decimal(item.receivedQuantity)
        const unitCost = new Decimal(item.unitCost)

        // Update WAC via InventoryService
        const { newAvgCost } = await InventoryService.recalculateWAC(
          businessId,
          item.productId,
          whId,
          qty,
          unitCost,
          tx
        )

        // Record Inventory Movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: whId,
            movementType: 'purchase',
            quantity: qty,
            unitCost: unitCost,
            totalCost: qty.mul(unitCost),
            referenceType: 'goods_receipt',
            referenceId: goodsReceipt.id,
            createdBy: userId,
          },
        })
      }

      // 2. Mark Goods Receipt as confirmed
      const updatedReceipt = await tx.goodsReceipt.update({
        where: { id: receiptId },
        data: {
          status: 'confirmed',
          updatedBy: userId,
        },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
        },
      })

      // 3. Update Purchase Order receiving status
      if (goodsReceipt.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: goodsReceipt.purchaseOrderId },
          include: { items: true },
        })

        if (po) {
          const confirmedReceipts = await tx.goodsReceipt.findMany({
            where: {
              purchaseOrderId: po.id,
              status: { in: ['confirmed', 'received'] },
            },
            include: { items: true },
          })

          const receivedMap = new Map<string, Decimal>()
          for (const gr of confirmedReceipts) {
            for (const gri of gr.items) {
              if (gri.purchaseOrderItemId) {
                const prev = receivedMap.get(gri.purchaseOrderItemId) || new Decimal(0)
                receivedMap.set(gri.purchaseOrderItemId, prev.plus(new Decimal(gri.receivedQuantity)))
              }
            }
          }

          let allReceived = true
          let someReceived = false

          for (const poItem of po.items) {
            const received = receivedMap.get(poItem.id) || new Decimal(0)
            const ordered = new Decimal(poItem.quantity)
            if (received.gt(0)) someReceived = true
            if (received.lt(ordered)) allReceived = false
          }

          const newPoStatus = allReceived
            ? PurchaseOrderStatus.received
            : someReceived
            ? PurchaseOrderStatus.processing
            : po.status

          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: newPoStatus, updatedBy: userId },
          })
        }
      }

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'goods_receipt',
          entityId: receiptId,
          action: 'confirm_receipt',
          changes: { status: 'confirmed' },
        },
        tx
      )

      return updatedReceipt
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * Get Goods Receipt by ID.
   */
  static async getById(businessId: string, receiptId: string) {
    const receipt = await prisma.goodsReceipt.findFirst({
      where: { id: receiptId, businessId },
      include: {
        supplier: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    })
    if (!receipt) throw new TenantAccessDeniedError('Goods Receipt')
    return receipt
  }

  /**
   * List goods receipts for a business.
   */
  static async list(businessId: string, filter?: { status?: string; supplierId?: string; purchaseOrderId?: string }) {
    return prisma.goodsReceipt.findMany({
      where: {
        businessId,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.supplierId ? { supplierId: filter.supplierId } : {}),
        ...(filter?.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
      },
      include: { supplier: true, warehouse: true },
      orderBy: { receiptDate: 'desc' },
    })
  }
}
