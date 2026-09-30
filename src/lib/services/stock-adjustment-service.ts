// =============================================================
// Stock Adjustment Service — Controlled Discrepancy & Loss Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { AccountingService } from './accounting-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export type StockAdjustmentType =
  | 'increase'
  | 'decrease'
  | 'damage'
  | 'loss'
  | 'found_stock'
  | 'opening_balance_correction'

export interface CreateAdjustmentItemInput {
  productId: string
  locationId?: string
  quantity: number | Decimal
  unitCost?: number | Decimal
  reason?: string
  batchId?: string
  serialId?: string
}

export interface CreateAdjustmentInput {
  warehouseId: string
  locationId?: string
  adjustmentType: StockAdjustmentType
  reason: string
  adjustmentDate?: Date | string
  items: CreateAdjustmentItemInput[]
  notes?: string
}

export class StockAdjustmentService {
  /**
   * Create a new stock adjustment draft.
   */
  static async createAdjustment(businessId: string, input: CreateAdjustmentInput, userId?: string) {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Adjustment must contain at least one item')
    }
    if (!input.reason?.trim()) {
      throw new ValidationError('A detailed reason is required for stock adjustments')
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, businessId },
    })
    if (!warehouse) throw new TenantAccessDeniedError('Warehouse')

    return prisma.$transaction(async (tx) => {
      const adjustmentNumber = await DocumentNumberingService.generateNumber(businessId, 'stock_adjustment', tx)
      const adjustmentDate = input.adjustmentDate ? new Date(input.adjustmentDate) : new Date()

      const itemsData = []
      for (const item of input.items) {
        const qty = new Decimal(item.quantity)
        if (qty.lte(0)) throw new ValidationError('Item quantity must be greater than zero')

        const product = await tx.product.findFirst({ where: { id: item.productId, businessId } })
        if (!product) throw new TenantAccessDeniedError('Product')

        const unitCost = item.unitCost !== undefined ? new Decimal(item.unitCost) : new Decimal(product.costPrice || 0)
        const totalCost = qty.mul(unitCost)

        itemsData.push({
          productId: item.productId,
          locationId: item.locationId || input.locationId,
          quantity: qty,
          unitCost,
          totalCost,
          reason: item.reason || input.reason,
          batchId: item.batchId,
          serialId: item.serialId,
        })
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          businessId,
          adjustmentNumber,
          adjustmentDate,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          reason: input.reason,
          adjustmentType: input.adjustmentType,
          status: 'draft',
          notes: input.notes,
          createdBy: userId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: { include: { product: true, location: true } },
          warehouse: true,
        },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'create',
          entityType: 'stock_adjustment',
          entityId: adjustment.id,
          newValues: { adjustmentNumber, type: input.adjustmentType, reason: input.reason },
        }, tx)
      }

      return adjustment
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Approve a stock adjustment before posting.
   */
  static async approveAdjustment(businessId: string, adjustmentId: string, userId?: string) {
    const adjustment = await prisma.stockAdjustment.findFirst({
      where: { id: adjustmentId, businessId },
    })
    if (!adjustment) throw new TenantAccessDeniedError('StockAdjustment')
    if (adjustment.status !== 'draft') {
      throw new ValidationError(`Adjustment cannot be approved from status "${adjustment.status}"`)
    }

    const updated = await prisma.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'approved',
        approvedBy: userId,
      },
      include: { items: { include: { product: true } }, warehouse: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'stock_adjustment',
        entityId: adjustmentId,
        newValues: { status: 'approved' },
      })
    }

    return updated
  }

  /**
   * Post a stock adjustment: Atomically executes InventoryMovements and GL Journal Entries.
   */
  static async postAdjustment(businessId: string, adjustmentId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.findFirst({
        where: { id: adjustmentId, businessId },
        include: { items: { include: { product: true } }, warehouse: true },
      })

      if (!adjustment) throw new TenantAccessDeniedError('StockAdjustment')
      if (adjustment.status === 'posted') {
        throw new ValidationError('Adjustment is already posted')
      }
      if (adjustment.status !== 'approved' && adjustment.status !== 'draft') {
        throw new ValidationError(`Cannot post adjustment with status "${adjustment.status}"`)
      }

      const isIncrease =
        adjustment.adjustmentType === 'increase' ||
        adjustment.adjustmentType === 'found_stock' ||
        adjustment.adjustmentType === 'opening_balance_correction'

      let totalAdjustmentValue = new Decimal(0)

      for (const item of adjustment.items) {
        const qty = new Decimal(item.quantity)
        const unitCost = new Decimal(item.unitCost)
        const lineTotalCost = qty.mul(unitCost)
        totalAdjustmentValue = totalAdjustmentValue.plus(lineTotalCost)

        if (isIncrease) {
          // Increase stock via WAC recalculation
          await InventoryService.recalculateWAC(
            businessId,
            item.productId,
            adjustment.warehouseId,
            qty,
            unitCost,
            tx
          )
        } else {
          // Issue/reduce stock
          await InventoryService.issueStock(
            businessId,
            item.productId,
            adjustment.warehouseId,
            qty,
            tx
          )
        }

        // Update Location Balance if location is provided
        if (item.locationId) {
          const locBal = await tx.inventoryLocationBalance.findUnique({
            where: {
              businessId_warehouseId_locationId_productId: {
                businessId,
                warehouseId: adjustment.warehouseId,
                locationId: item.locationId,
                productId: item.productId,
              },
            },
          })
          const currentLocQty = locBal ? new Decimal(locBal.quantity) : new Decimal(0)
          const newLocQty = isIncrease ? currentLocQty.plus(qty) : Decimal.max(0, currentLocQty.minus(qty))

          await tx.inventoryLocationBalance.upsert({
            where: {
              businessId_warehouseId_locationId_productId: {
                businessId,
                warehouseId: adjustment.warehouseId,
                locationId: item.locationId,
                productId: item.productId,
              },
            },
            update: {
              quantity: newLocQty,
              availableQuantity: Decimal.max(0, newLocQty.minus(new Decimal(locBal?.reservedQuantity || 0))),
            },
            create: {
              businessId,
              warehouseId: adjustment.warehouseId,
              locationId: item.locationId,
              productId: item.productId,
              quantity: newLocQty,
              reservedQuantity: new Decimal(0),
              availableQuantity: newLocQty,
            },
          })
        }

        // Record InventoryMovement
        const movementType = isIncrease ? 'adjustment_increase' : 'adjustment_decrease'
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: adjustment.warehouseId,
            locationId: item.locationId,
            batchId: item.batchId,
            serialId: item.serialId,
            movementType: movementType as any,
            quantity: isIncrease ? qty : qty.negated(),
            unitCost,
            totalCost: lineTotalCost,
            referenceType: 'adjustment',
            referenceId: adjustment.id,
            createdBy: userId,
          },
        })
      }

      // Generate General Ledger Entry
      let journalEntryId: string | null = null
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Inventory Asset
      const adjAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '5900' } }) // Inventory Adjustment / Expense

      if (invAccount && adjAccount && totalAdjustmentValue.gt(0)) {
        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
        const journal = await AccountingService.postJournalEntry(
          {
            businessId,
            entryNumber: jeNumber,
            entryDate: adjustment.adjustmentDate,
            description: `Stock Adjustment (${adjustment.adjustmentType}) ${adjustment.adjustmentNumber}: ${adjustment.reason}`,
            currencyCode: 'USD',
            exchangeRate: 1,
            sourceType: 'inventory_adjustment',
            sourceId: adjustment.id,
            lines: [
              {
                accountId: isIncrease ? invAccount.id : adjAccount.id,
                debitAmount: totalAdjustmentValue.toNumber(),
                creditAmount: 0,
              },
              {
                accountId: isIncrease ? adjAccount.id : invAccount.id,
                debitAmount: 0,
                creditAmount: totalAdjustmentValue.toNumber(),
              },
            ],
            userId: userId || adjustment.createdBy || '00000000-0000-0000-0000-000000000000',
          },
          tx
        )
        journalEntryId = journal.id
      }

      const updated = await tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'posted',
          postedBy: userId,
          journalEntryId,
        },
        include: { items: { include: { product: true, location: true } }, warehouse: true },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'post',
          entityType: 'stock_adjustment',
          entityId: adjustmentId,
          newValues: { status: 'posted', journalEntryId, totalValue: totalAdjustmentValue.toNumber() },
        }, tx)
      }

      return updated
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Convenience helper to create and immediately post a stock adjustment atomically.
   */
  static async createAndPostAdjustment(businessId: string, input: CreateAdjustmentInput, userId?: string) {
    const adj = await this.createAdjustment(businessId, input, userId)
    return this.postAdjustment(businessId, adj.id, userId)
  }

  static async getAdjustment(businessId: string, adjustmentId: string) {
    const adj = await prisma.stockAdjustment.findFirst({
      where: { id: adjustmentId, businessId },
      include: {
        warehouse: true,
        items: { include: { product: true, location: true } },
      },
    })
    if (!adj) throw new TenantAccessDeniedError('StockAdjustment')
    return adj
  }

  static async listAdjustments(businessId: string, filters?: { status?: string; warehouseId?: string }) {
    const where: any = { businessId }
    if (filters?.status) where.status = filters.status
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId

    return prisma.stockAdjustment.findMany({
      where,
      include: {
        warehouse: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
