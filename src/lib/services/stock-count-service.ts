// =============================================================
// Stock Counting Service — Physical Inventory & Variance Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { AccountingService } from './accounting-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export type StockCountStatus = 'draft' | 'counting' | 'review' | 'approved' | 'posted' | 'cancelled'
export type StockCountType = 'full' | 'cycle' | 'spot'

export interface CreateStockCountInput {
  warehouseId: string
  locationId?: string
  countType?: StockCountType
  countDate?: Date | string
  productIds?: string[] // Optional filter for cycle or spot counts
  notes?: string
}

export interface RecordCountItemInput {
  productId: string
  locationId?: string
  countedQuantity: number | Decimal
  notes?: string
}

export class StockCountService {
  /**
   * Create a new Stock Count and snapshot current expected stock quantities.
   */
  static async createStockCount(businessId: string, input: CreateStockCountInput, userId?: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, businessId },
    })
    if (!warehouse) throw new TenantAccessDeniedError('Warehouse')

    return prisma.$transaction(async (tx) => {
      const countNumber = await DocumentNumberingService.generateNumber(businessId, 'stock_count', tx)
      const countDate = input.countDate ? new Date(input.countDate) : new Date()

      // Find products to count
      const whereProduct: any = { businessId, trackInventory: true, isActive: true }
      if (input.productIds && input.productIds.length > 0) {
        whereProduct.id = { in: input.productIds }
      }

      const products = await tx.product.findMany({
        where: whereProduct,
        include: {
          inventoryBalances: {
            where: { warehouseId: input.warehouseId },
          },
        },
      })

      const countItemsData = []
      for (const product of products) {
        const bal = product.inventoryBalances[0]
        const snapshotQty = bal ? new Decimal(bal.quantity) : new Decimal(0)
        const unitCost = new Decimal(product.costPrice || 0)

        countItemsData.push({
          productId: product.id,
          locationId: input.locationId,
          snapshotQuantity: snapshotQty,
          countedQuantity: null,
          varianceQuantity: new Decimal(0),
          unitCost,
          varianceValue: new Decimal(0),
        })
      }

      const stockCount = await tx.stockCount.create({
        data: {
          businessId,
          countNumber,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          countType: input.countType || 'full',
          countDate,
          status: 'draft',
          notes: input.notes,
          countedBy: userId,
          items: {
            create: countItemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
        },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'create',
          entityType: 'stock_count',
          entityId: stockCount.id,
          newValues: { countNumber, type: stockCount.countType, itemsCount: countItemsData.length },
        }, tx)
      }

      return stockCount
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Transition count status to 'counting'.
   */
  static async startCounting(businessId: string, stockCountId: string, userId?: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')
    if (count.status !== 'draft') {
      throw new ValidationError(`Cannot start counting from status "${count.status}"`)
    }

    const updated = await prisma.stockCount.update({
      where: { id: stockCountId },
      data: { status: 'counting', countedBy: userId || count.countedBy },
      include: { items: { include: { product: true } }, warehouse: true },
    })

    return updated
  }

  /**
   * Record physical counted quantities and compute variances.
   */
  static async recordCountItems(
    businessId: string,
    stockCountId: string,
    items: RecordCountItemInput[],
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id: stockCountId, businessId },
        include: { items: true },
      })

      if (!count) throw new TenantAccessDeniedError('StockCount')
      if (count.status !== 'draft' && count.status !== 'counting' && count.status !== 'review') {
        throw new ValidationError(`Cannot record counts for stock count with status "${count.status}"`)
      }

      for (const itemInput of items) {
        const countedQty = new Decimal(itemInput.countedQuantity)
        if (countedQty.lt(0)) throw new ValidationError('Counted quantity cannot be negative')

        const existingItem = count.items.find((i) => i.productId === itemInput.productId)
        if (existingItem) {
          const snapshotQty = new Decimal(existingItem.snapshotQuantity)
          const varianceQty = countedQty.minus(snapshotQty)
          const varianceVal = varianceQty.mul(new Decimal(existingItem.unitCost))

          await tx.stockCountItem.update({
            where: { id: existingItem.id },
            data: {
              countedQuantity: countedQty,
              varianceQuantity: varianceQty,
              varianceValue: varianceVal,
              notes: itemInput.notes,
            },
          })
        } else {
          // Additional item found during counting
          const product = await tx.product.findFirst({ where: { id: itemInput.productId, businessId } })
          if (product) {
            const unitCost = new Decimal(product.costPrice || 0)
            const varianceQty = countedQty
            const varianceVal = varianceQty.mul(unitCost)

            await tx.stockCountItem.create({
              data: {
                stockCountId,
                productId: itemInput.productId,
                locationId: itemInput.locationId || count.locationId,
                snapshotQuantity: new Decimal(0),
                countedQuantity: countedQty,
                varianceQuantity: varianceQty,
                unitCost,
                varianceValue: varianceVal,
                notes: itemInput.notes,
              },
            })
          }
        }
      }

      const updated = await tx.stockCount.findUnique({
        where: { id: stockCountId },
        include: { items: { include: { product: true } }, warehouse: true },
      })

      return updated
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Submit count for review.
   */
  static async submitForReview(businessId: string, stockCountId: string, userId?: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
      include: { items: true },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')

    const uncounted = count.items.filter((i) => i.countedQuantity === null)
    if (uncounted.length > 0) {
      throw new ValidationError(`All items must be counted before submitting for review (${uncounted.length} remaining)`)
    }

    const updated = await prisma.stockCount.update({
      where: { id: stockCountId },
      data: { status: 'review' },
      include: { items: { include: { product: true } }, warehouse: true },
    })

    return updated
  }

  /**
   * Approve the reviewed count.
   */
  static async approveCount(businessId: string, stockCountId: string, userId?: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')
    if (count.status !== 'review' && count.status !== 'counting' && count.status !== 'draft') {
      throw new ValidationError(`Cannot approve stock count from status "${count.status}"`)
    }

    const updated = await prisma.stockCount.update({
      where: { id: stockCountId },
      data: { status: 'approved', approvedBy: userId },
      include: { items: { include: { product: true } }, warehouse: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'stock_count',
        entityId: stockCountId,
        newValues: { status: 'approved' },
      })
    }

    return updated
  }

  /**
   * Post stock count: Immutably post stock adjustments for all variances and record double-entry GL entry.
   */
  static async postCount(businessId: string, stockCountId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id: stockCountId, businessId },
        include: { items: { include: { product: true } }, warehouse: true },
      })

      if (!count) throw new TenantAccessDeniedError('StockCount')
      if (count.status === 'posted') {
        throw new ValidationError('Stock count has already been posted and is immutable')
      }
      if (count.status !== 'approved' && count.status !== 'review' && count.status !== 'counting' && count.status !== 'draft') {
        throw new ValidationError(`Cannot post stock count with status "${count.status}"`)
      }

      let netVarianceValue = new Decimal(0)
      let totalGainValue = new Decimal(0)
      let totalLossValue = new Decimal(0)

      for (const item of count.items) {
        if (item.countedQuantity === null) continue
        const varianceQty = new Decimal(item.varianceQuantity)
        if (varianceQty.isZero()) continue

        const unitCost = new Decimal(item.unitCost)
        const itemVarianceVal = varianceQty.mul(unitCost)
        netVarianceValue = netVarianceValue.plus(itemVarianceVal)

        if (varianceQty.gt(0)) {
          totalGainValue = totalGainValue.plus(itemVarianceVal)
          // Gain: Increase stock via WAC recalculation
          await InventoryService.recalculateWAC(
            businessId,
            item.productId,
            count.warehouseId,
            varianceQty,
            unitCost,
            tx
          )

          await tx.inventoryMovement.create({
            data: {
              businessId,
              productId: item.productId,
              warehouseId: count.warehouseId,
              locationId: item.locationId,
              movementType: 'adjustment_increase',
              quantity: varianceQty,
              unitCost,
              totalCost: itemVarianceVal,
              referenceType: 'stock_count',
              referenceId: count.id,
              createdBy: userId,
            },
          })
        } else {
          // Loss: Issue/deduct stock
          const absQty = varianceQty.abs()
          totalLossValue = totalLossValue.plus(absQty.mul(unitCost))

          await InventoryService.issueStock(
            businessId,
            item.productId,
            count.warehouseId,
            absQty,
            tx
          )

          await tx.inventoryMovement.create({
            data: {
              businessId,
              productId: item.productId,
              warehouseId: count.warehouseId,
              locationId: item.locationId,
              movementType: 'adjustment_decrease',
              quantity: varianceQty,
              unitCost,
              totalCost: absQty.mul(unitCost),
              referenceType: 'stock_count',
              referenceId: count.id,
              createdBy: userId,
            },
          })
        }
      }

      // Generate GL Journal Entry for stock count variances if Chart of Accounts is configured
      let journalEntryId: string | null = null
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Inventory Asset
      const varianceAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '5900' } }) // Inventory Variance / Adjustment

      if (invAccount && varianceAccount && !netVarianceValue.isZero()) {
        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
        const isNetGain = netVarianceValue.gt(0)
        const absNetValue = netVarianceValue.abs()

        const journal = await AccountingService.postJournalEntry(
          {
            businessId,
            entryNumber: jeNumber,
            entryDate: count.countDate,
            description: `Stock Count Variance Adjustment for ${count.countNumber}`,
            currencyCode: 'USD',
            exchangeRate: 1,
            sourceType: 'inventory_adjustment',
            sourceId: count.id,
            lines: [
              {
                accountId: isNetGain ? invAccount.id : varianceAccount.id,
                debitAmount: absNetValue.toNumber(),
                creditAmount: 0,
              },
              {
                accountId: isNetGain ? varianceAccount.id : invAccount.id,
                debitAmount: 0,
                creditAmount: absNetValue.toNumber(),
              },
            ],
            userId: userId || count.countedBy || '00000000-0000-0000-0000-000000000000',
          },
          tx
        )
        journalEntryId = journal.id
      }

      const updated = await tx.stockCount.update({
        where: { id: stockCountId },
        data: {
          status: 'posted',
          postedBy: userId,
          journalEntryId,
        },
        include: { items: { include: { product: true } }, warehouse: true },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'post',
          entityType: 'stock_count',
          entityId: stockCountId,
          newValues: {
            status: 'posted',
            netVariance: netVarianceValue.toNumber(),
            totalGain: totalGainValue.toNumber(),
            totalLoss: totalLossValue.toNumber(),
          },
        }, tx)
      }

      return updated
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Cancel a count.
   */
  static async cancelCount(businessId: string, stockCountId: string, userId?: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')
    if (count.status === 'posted') {
      throw new ValidationError('Cannot cancel a posted stock count (it is immutable)')
    }

    const updated = await prisma.stockCount.update({
      where: { id: stockCountId },
      data: { status: 'cancelled' },
    })

    return updated
  }

  static async getStockCount(businessId: string, stockCountId: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
      include: {
        warehouse: true,
        items: {
          include: { product: true, location: true },
        },
      },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')
    return count
  }

  static async listStockCounts(businessId: string, filters?: { status?: string; warehouseId?: string }) {
    const where: any = { businessId }
    if (filters?.status) where.status = filters.status
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId

    return prisma.stockCount.findMany({
      where,
      include: {
        warehouse: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
