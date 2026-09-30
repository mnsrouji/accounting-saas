// =============================================================
// Batch, Lot & Serial Number Tracking Service
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'

export interface CreateBatchInput {
  productId: string
  warehouseId: string
  locationId?: string
  lotNumber: string
  batchNumber?: string
  manufacturingDate?: Date | string
  expiryDate?: Date | string
  quantity: number | Decimal
  unitCost?: number | Decimal
  notes?: string
}

export interface RegisterSerialsInput {
  productId: string
  warehouseId?: string
  locationId?: string
  serialNumbers: string[]
  purchaseReference?: string
  unitCost?: number | Decimal
  notes?: string
}

export class BatchSerialService {
  // ==========================================
  // BATCH / LOT TRACKING
  // ==========================================

  /**
   * Create or register a product batch/lot.
   */
  static async createBatch(businessId: string, input: CreateBatchInput, userId?: string) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, businessId },
    })
    if (!product) throw new TenantAccessDeniedError('Product')

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, businessId },
    })
    if (!warehouse) throw new TenantAccessDeniedError('Warehouse')

    const existing = await prisma.productBatch.findFirst({
      where: { businessId, productId: input.productId, lotNumber: input.lotNumber },
    })
    if (existing) {
      throw new ValidationError(`Lot number "${input.lotNumber}" already exists for this product`)
    }

    const qty = new Decimal(input.quantity)
    const unitCost = input.unitCost !== undefined ? new Decimal(input.unitCost) : new Decimal(product.costPrice || 0)

    const batch = await prisma.productBatch.create({
      data: {
        businessId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        lotNumber: input.lotNumber,
        batchNumber: input.batchNumber,
        manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        initialQuantity: qty,
        quantity: qty,
        reservedQuantity: new Decimal(0),
        availableQuantity: qty,
        unitCost,
        status: 'active',
        notes: input.notes,
      },
      include: { product: true, warehouse: true, location: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'create',
        entityType: 'product_batch',
        entityId: batch.id,
        newValues: { lotNumber: input.lotNumber, productId: input.productId, quantity: qty.toNumber() },
      })
    }

    return batch
  }

  /**
   * Quarantine a batch to prevent sale/delivery due to quality/expiry issues.
   */
  static async quarantineBatch(businessId: string, batchId: string, reason: string, userId?: string) {
    const batch = await prisma.productBatch.findFirst({
      where: { id: batchId, businessId },
    })
    if (!batch) throw new TenantAccessDeniedError('ProductBatch')

    const updated = await prisma.productBatch.update({
      where: { id: batchId },
      data: {
        status: 'quarantined',
        notes: batch.notes ? `${batch.notes} | Quarantined: ${reason}` : `Quarantined: ${reason}`,
      },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'product_batch',
        entityId: batchId,
        newValues: { status: 'quarantined', reason },
      })
    }

    return updated
  }

  /**
   * Get batches expiring soon (within specified days).
   */
  static async getExpiringSoonBatches(businessId: string, daysAhead = 30) {
    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysAhead)

    return prisma.productBatch.findMany({
      where: {
        businessId,
        status: 'active',
        quantity: { gt: 0 },
        expiryDate: {
          gte: now,
          lte: targetDate,
        },
      },
      include: { product: true, warehouse: true, location: true },
      orderBy: { expiryDate: 'asc' },
    })
  }

  /**
   * Get already expired active batches with remaining stock.
   */
  static async getExpiredBatches(businessId: string) {
    const now = new Date()

    return prisma.productBatch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        expiryDate: {
          lt: now,
        },
      },
      include: { product: true, warehouse: true, location: true },
      orderBy: { expiryDate: 'asc' },
    })
  }

  static async listBatches(businessId: string, filters?: { productId?: string; warehouseId?: string; status?: string }) {
    const where: any = { businessId }
    if (filters?.productId) where.productId = filters.productId
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId
    if (filters?.status) where.status = filters.status

    return prisma.productBatch.findMany({
      where,
      include: { product: true, warehouse: true, location: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ==========================================
  // SERIAL NUMBER TRACKING
  // ==========================================

  /**
   * Register unique serial numbers for a product (e.g. upon Goods Receipt or initial count).
   */
  static async registerSerialNumbers(businessId: string, input: RegisterSerialsInput, userId?: string, tx?: any) {
    const client = tx ?? prisma

    const product = await client.product.findFirst({
      where: { id: input.productId, businessId },
    })
    if (!product) throw new TenantAccessDeniedError('Product')

    // Check for duplicate serial numbers within business and product
    const existing = await client.productSerialNumber.findMany({
      where: {
        businessId,
        productId: input.productId,
        serialNumber: { in: input.serialNumbers },
      },
    })

    if (existing.length > 0) {
      const dupes = existing.map((e: any) => e.serialNumber).join(', ')
      throw new ValidationError(`Serial numbers already registered for this product: ${dupes}`)
    }

    const unitCost = input.unitCost !== undefined ? new Decimal(input.unitCost) : new Decimal(product.costPrice || 0)

    const createdSerials = []
    for (const sn of input.serialNumbers) {
      const serial = await client.productSerialNumber.create({
        data: {
          businessId,
          productId: input.productId,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          serialNumber: sn.trim(),
          status: 'in_stock',
          purchaseReference: input.purchaseReference,
          unitCost,
          notes: input.notes,
        },
      })
      createdSerials.push(serial)
    }

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'create',
        entityType: 'product_serial',
        entityId: input.productId,
        newValues: { count: createdSerials.length, serials: input.serialNumbers },
      })
    }

    return createdSerials
  }

  /**
   * Assign serial numbers to a delivery/sale.
   */
  static async assignSerialToDelivery(
    businessId: string,
    serialNumber: string,
    deliveryReference: string,
    tx?: any
  ) {
    const client = tx ?? prisma

    const serial = await client.productSerialNumber.findFirst({
      where: { businessId, serialNumber, status: 'in_stock' },
    })

    if (!serial) {
      throw new ValidationError(`Serial number "${serialNumber}" is not in stock or available for delivery`)
    }

    return client.productSerialNumber.update({
      where: { id: serial.id },
      data: {
        status: 'delivered',
        deliveryReference,
      },
    })
  }

  /**
   * Record a returned serial number.
   */
  static async recordSerialReturn(
    businessId: string,
    serialNumber: string,
    returnReference: string,
    tx?: any
  ) {
    const client = tx ?? prisma

    const serial = await client.productSerialNumber.findFirst({
      where: { businessId, serialNumber },
    })

    if (!serial) {
      throw new TenantAccessDeniedError('ProductSerialNumber')
    }

    return client.productSerialNumber.update({
      where: { id: serial.id },
      data: {
        status: 'returned',
        returnReference,
      },
    })
  }

  /**
   * Get full lifecycle history for a serial number.
   */
  static async getSerialHistory(businessId: string, serialNumber: string) {
    const serial = await prisma.productSerialNumber.findFirst({
      where: { businessId, serialNumber },
      include: {
        product: true,
        warehouse: true,
        location: true,
      },
    })
    if (!serial) throw new TenantAccessDeniedError('ProductSerialNumber')
    return serial
  }

  static async listSerials(
    businessId: string,
    filters?: { productId?: string; warehouseId?: string; status?: string }
  ) {
    const where: any = { businessId }
    if (filters?.productId) where.productId = filters.productId
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId
    if (filters?.status) where.status = filters.status

    return prisma.productSerialNumber.findMany({
      where,
      include: { product: true, warehouse: true, location: true },
      orderBy: { createdAt: 'desc' },
    })
  }
}
