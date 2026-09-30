// =============================================================
// Inventory Traceability Service — End-to-End Stock Audit & Movement Lineage
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { TenantAccessDeniedError } from '@/lib/errors/accounting-error'

export interface TraceabilityEvent {
  id: string
  date: Date
  type:
    | 'purchase_order'
    | 'goods_receipt'
    | 'warehouse_transfer'
    | 'stock_reservation'
    | 'delivery'
    | 'sale'
    | 'sales_return'
    | 'purchase_return'
    | 'adjustment'
    | 'stock_count'
  referenceNumber: string
  warehouseName: string
  locationCode?: string | null
  quantityChange: number
  runningBalance?: number
  unitCost: number
  totalValue: number
  details: Record<string, any>
}

export class InventoryTraceabilityService {
  /**
   * Get complete end-to-end operational traceability history for a product.
   * Trace: Purchase → Receipt → Warehouse → Transfer → Reservation → Delivery → Return
   */
  static async getProductTraceability(businessId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
      include: {
        inventoryBalances: { include: { warehouse: true } },
        locationBalances: { include: { warehouse: true, location: true } },
      },
    })
    if (!product) throw new TenantAccessDeniedError('Product')

    // 1. Fetch Inventory Movements chronologically
    const movements = await prisma.inventoryMovement.findMany({
      where: { businessId, productId },
      include: {
        warehouse: true,
        location: true,
        batch: true,
        serial: true,
        creator: { select: { fullName: true, email: true } },
      },
      orderBy: { movementDate: 'asc' },
    })

    // 2. Fetch Active and Historical Reservations
    const reservations = await prisma.stockReservation.findMany({
      where: { businessId, productId },
      include: {
        warehouse: true,
        location: true,
        salesOrder: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 3. Compile timeline with running balance
    let runningBalance = new Decimal(0)
    const timeline: TraceabilityEvent[] = []

    for (const m of movements) {
      const qty = new Decimal(m.quantity)
      runningBalance = runningBalance.plus(qty)

      timeline.push({
        id: m.id,
        date: m.movementDate,
        type: this.mapMovementTypeToEventType(m.movementType),
        referenceNumber: m.referenceId || m.referenceType || 'N/A',
        warehouseName: m.warehouse.name,
        locationCode: m.location?.code ?? null,
        quantityChange: qty.toNumber(),
        runningBalance: runningBalance.toNumber(),
        unitCost: new Decimal(m.unitCost).toNumber(),
        totalValue: new Decimal(m.totalCost).toNumber(),
        details: {
          movementType: m.movementType,
          referenceType: m.referenceType,
          batchNumber: m.batch?.lotNumber,
          serialNumber: m.serial?.serialNumber,
          createdBy: m.creator?.fullName || m.creator?.email,
        },
      })
    }

    return {
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        unitOfMeasure: product.unitOfMeasure,
        costPrice: new Decimal(product.costPrice).toNumber(),
        currentTotalOnHand: product.inventoryBalances.reduce(
          (sum, b) => sum.plus(new Decimal(b.quantity)),
          new Decimal(0)
        ).toNumber(),
        currentTotalReserved: product.inventoryBalances.reduce(
          (sum, b) => sum.plus(new Decimal(b.reservedQuantity)),
          new Decimal(0)
        ).toNumber(),
        currentTotalAvailable: product.inventoryBalances.reduce(
          (sum, b) => sum.plus(new Decimal(b.availableQuantity)),
          new Decimal(0)
        ).toNumber(),
      },
      warehouses: product.inventoryBalances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        onHand: new Decimal(b.quantity).toNumber(),
        reserved: new Decimal(b.reservedQuantity).toNumber(),
        available: new Decimal(b.availableQuantity).toNumber(),
        averageCost: new Decimal(b.averageCost).toNumber(),
      })),
      locations: product.locationBalances.map((l) => ({
        warehouseId: l.warehouseId,
        warehouseName: l.warehouse.name,
        locationId: l.locationId,
        locationCode: l.location.code,
        onHand: new Decimal(l.quantity).toNumber(),
        reserved: new Decimal(l.reservedQuantity).toNumber(),
        available: new Decimal(l.availableQuantity).toNumber(),
      })),
      reservations: reservations.map((r) => ({
        id: r.id,
        salesOrderNumber: r.salesOrder?.orderNumber,
        warehouseName: r.warehouse.name,
        locationCode: r.location?.code,
        reservedQuantity: new Decimal(r.reservedQuantity).toNumber(),
        consumedQuantity: new Decimal(r.consumedQuantity).toNumber(),
        status: r.status,
        createdAt: r.createdAt,
      })),
      timeline,
    }
  }

  /**
   * Get complete traceability history for a specific batch / lot.
   */
  static async getBatchTraceability(businessId: string, batchId: string) {
    const batch = await prisma.productBatch.findFirst({
      where: { id: batchId, businessId },
      include: {
        product: true,
        warehouse: true,
        location: true,
        inventoryMovements: {
          include: { warehouse: true, location: true },
          orderBy: { movementDate: 'asc' },
        },
      },
    })
    if (!batch) throw new TenantAccessDeniedError('ProductBatch')

    return batch
  }

  /**
   * Get complete traceability history for a specific serial number.
   */
  static async getSerialTraceability(businessId: string, serialNumber: string) {
    const serial = await prisma.productSerialNumber.findFirst({
      where: { businessId, serialNumber },
      include: {
        product: true,
        warehouse: true,
        location: true,
        inventoryMovements: {
          include: { warehouse: true, location: true },
          orderBy: { movementDate: 'asc' },
        },
      },
    })
    if (!serial) throw new TenantAccessDeniedError('ProductSerialNumber')

    return serial
  }

  private static mapMovementTypeToEventType(movementType: string): TraceabilityEvent['type'] {
    switch (movementType) {
      case 'purchase':
        return 'goods_receipt'
      case 'sale':
        return 'delivery'
      case 'sales_return':
        return 'sales_return'
      case 'purchase_return':
        return 'purchase_return'
      case 'transfer_in':
      case 'transfer_out':
        return 'warehouse_transfer'
      case 'adjustment_increase':
      case 'adjustment_decrease':
        return 'adjustment'
      default:
        return 'adjustment'
    }
  }
}
