// =============================================================
// Inventory Service Engine & Weighted Average Costing (WAC)
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  inventoryAdjustmentSchema,
  warehouseTransferSchema,
  InventoryAdjustmentInput,
  WarehouseTransferInput,
} from '@/lib/validations/accounting-schemas'
import { InsufficientStockError, TenantAccessDeniedError } from '@/lib/errors/accounting-error'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class InventoryService {
  /**
   * Recalculate and update Weighted Average Cost (WAC) for a product upon new stock purchase.
   */
  static async recalculateWAC(
    businessId: string,
    productId: string,
    warehouseId: string,
    incomingQty: Decimal,
    incomingUnitCost: Decimal,
    tx: any
  ) {
    const existingBalance = await tx.inventoryBalance.findUnique({
      where: { businessId_productId_warehouseId: { businessId, productId, warehouseId } },
    })

    const existingQty = existingBalance ? new Decimal(existingBalance.quantity) : new Decimal(0)
    const existingAvgCost = existingBalance ? new Decimal(existingBalance.averageCost) : new Decimal(0)

    const totalExistingValue = existingQty.mul(existingAvgCost)
    const totalIncomingValue = incomingQty.mul(incomingUnitCost)
    const newQty = existingQty.plus(incomingQty)

    let newAvgCost = incomingUnitCost
    if (newQty.gt(0)) {
      newAvgCost = totalExistingValue.plus(totalIncomingValue).div(newQty)
    }

    // Update Product costPrice and InventoryBalance averageCost
    await tx.product.update({
      where: { id: productId },
      data: { costPrice: newAvgCost },
    })

    const balance = await tx.inventoryBalance.upsert({
      where: { businessId_productId_warehouseId: { businessId, productId, warehouseId } },
      update: {
        quantity: newQty,
        availableQuantity: newQty.minus(existingBalance ? new Decimal(existingBalance.reservedQuantity) : 0),
        averageCost: newAvgCost,
      },
      create: {
        businessId,
        productId,
        warehouseId,
        quantity: newQty,
        reservedQuantity: new Decimal(0),
        availableQuantity: newQty,
        averageCost: newAvgCost,
      },
    })

    return { newQty, newAvgCost, balance }
  }

  /**
   * Record inventory issue (stock reduction on sale or return).
   *
   * CONCURRENCY SAFETY:
   * Uses an atomic SQL UPDATE with a WHERE quantity >= qtyToIssue condition.
   * This prevents the race condition where two concurrent transactions both
   * read sufficient stock, both pass the check, and both reduce inventory —
   * resulting in negative stock. The single atomic UPDATE guarantees exactly
   * one transaction wins; the other gets 0 affected rows and throws.
   */
  static async issueStock(
    businessId: string,
    productId: string,
    warehouseId: string,
    qtyToIssue: Decimal,
    tx: any
  ) {
    // First: fetch current balance for product name (for error messages) and cost
    const existingBalance = await tx.inventoryBalance.findUnique({
      where: { businessId_productId_warehouseId: { businessId, productId, warehouseId } },
      include: { product: true },
    })

    const currentAvgCost = existingBalance
      ? new Decimal(existingBalance.averageCost)
      : new Decimal(0)

    // Atomic UPDATE: only reduces stock if quantity >= qtyToIssue.
    // If another concurrent transaction already reduced it below the threshold,
    // this update affects 0 rows, and we throw InsufficientStockError.
    const result = await tx.$executeRaw`
      UPDATE inventory_balances
      SET
        quantity = quantity - ${qtyToIssue.toNumber()},
        available_quantity = GREATEST(0, quantity - ${qtyToIssue.toNumber()} - reserved_quantity),
        updated_at = NOW()
      WHERE business_id = ${businessId}::uuid
        AND product_id = ${productId}::uuid
        AND warehouse_id = ${warehouseId}::uuid
        AND quantity >= ${qtyToIssue.toNumber()}
    `

    if (result === 0) {
      // Either no record exists or insufficient stock — determine which for a better message
      const currentQty = existingBalance ? new Decimal(existingBalance.quantity) : new Decimal(0)
      throw new InsufficientStockError(
        existingBalance?.product?.name || productId,
        qtyToIssue.toNumber(),
        currentQty.toNumber()
      )
    }

    // Re-fetch to get the updated quantity for the return value
    const updatedBalance = await tx.inventoryBalance.findUnique({
      where: { businessId_productId_warehouseId: { businessId, productId, warehouseId } },
    })

    const newQty = updatedBalance ? new Decimal(updatedBalance.quantity) : new Decimal(0)

    return { currentAvgCost, newQty }
  }

  /**
   * Warehouse Transfer: Transfer stock between two warehouses atomically.
   */
  static async executeTransfer(input: WarehouseTransferInput) {
    const validated = warehouseTransferSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const { businessId, productId, fromWarehouseId, toWarehouseId, quantity, userId } = validated
      const qty = new Decimal(quantity)

      // 1. Issue stock from source warehouse
      const { currentAvgCost } = await this.issueStock(businessId, productId, fromWarehouseId, qty, tx)

      // 2. Record transfer_out movement
      await tx.inventoryMovement.create({
        data: {
          businessId,
          productId,
          warehouseId: fromWarehouseId,
          movementType: 'transfer_out',
          quantity: qty.negated(),
          unitCost: currentAvgCost,
          totalCost: qty.mul(currentAvgCost),
          referenceType: 'transfer',
          createdBy: userId,
        },
      })

      // 3. Receive stock into destination warehouse using currentAvgCost
      await this.recalculateWAC(businessId, productId, toWarehouseId, qty, currentAvgCost, tx)

      // 4. Record transfer_in movement
      await tx.inventoryMovement.create({
        data: {
          businessId,
          productId,
          warehouseId: toWarehouseId,
          movementType: 'transfer_in',
          quantity: qty,
          unitCost: currentAvgCost,
          totalCost: qty.mul(currentAvgCost),
          referenceType: 'transfer',
          createdBy: userId,
        },
      })

      return { success: true, transferredQty: qty.toNumber(), unitCost: currentAvgCost.toNumber() }
    })
  }

  /**
   * Stock Count Adjustment (Increase or Decrease) with General Ledger Posting.
   */
  static async adjustStock(input: InventoryAdjustmentInput) {
    const validated = inventoryAdjustmentSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const { businessId, productId, warehouseId, adjustmentType, quantity, reason, userId } = validated
      const qty = new Decimal(quantity)

      const product = await tx.product.findFirst({
        where: { id: productId, businessId },
      })

      if (!product) throw new TenantAccessDeniedError('Product')

      const currentCost = new Decimal(product.costPrice)
      const totalCost = qty.mul(currentCost)

      if (adjustmentType === 'adjustment_increase') {
        await this.recalculateWAC(businessId, productId, warehouseId, qty, currentCost, tx)
      } else {
        await this.issueStock(businessId, productId, warehouseId, qty, tx)
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          businessId,
          productId,
          warehouseId,
          movementType: adjustmentType as any,
          quantity: adjustmentType === 'adjustment_increase' ? qty : qty.negated(),
          unitCost: currentCost,
          totalCost: totalCost,
          referenceType: 'adjustment',
          createdBy: userId,
        },
      })

      // Generate Accounting Entry if Chart of Accounts exists
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Inventory Asset
      const adjAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '5900' } }) // Other Expense / Adjustment

      if (invAccount && adjAccount && totalCost.gt(0)) {
        const isIncrease = adjustmentType === 'adjustment_increase'

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
        await AccountingService.postJournalEntry({
          businessId,
          entryNumber: jeNumber,
          entryDate: new Date(),
          description: `Inventory Adjustment (${adjustmentType}): ${reason}`,
          currencyCode: 'USD',
          exchangeRate: 1,
          sourceType: 'inventory_adjustment',
          sourceId: movement.id,
          lines: [
            {
              accountId: isIncrease ? invAccount.id : adjAccount.id,
              debitAmount: totalCost.toNumber(),
              creditAmount: 0,
              productId,
            },
            {
              accountId: isIncrease ? adjAccount.id : invAccount.id,
              debitAmount: 0,
              creditAmount: totalCost.toNumber(),
              productId,
            },
          ],
          userId,
        }, tx)
      }

      return movement
    })
  }
}
