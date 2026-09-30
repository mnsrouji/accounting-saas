// =============================================================
// Inventory Reporting & Analytics Engine — Valuation, KPIs & Stock Reports
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { TenantAccessDeniedError } from '@/lib/errors/accounting-error'

export class InventoryReportingService {
  /**
   * 1. Stock on Hand & Availability Report.
   */
  static async getStockOnHandReport(businessId: string, filters?: { warehouseId?: string; categoryId?: string }) {
    const whereProduct: any = { businessId, trackInventory: true, isActive: true, deletedAt: null }
    if (filters?.categoryId) whereProduct.categoryId = filters.categoryId

    const products = await prisma.product.findMany({
      where: whereProduct,
      include: {
        category: { select: { name: true } },
        inventoryBalances: filters?.warehouseId ? { where: { warehouseId: filters.warehouseId }, include: { warehouse: true } } : { include: { warehouse: true } },
      },
      orderBy: { name: 'asc' },
    })

    return products.map((p) => {
      const onHand = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))
      const reserved = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.reservedQuantity)), new Decimal(0))
      const available = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.availableQuantity)), new Decimal(0))
      const avgCost = new Decimal(p.costPrice || 0)
      const totalValuation = onHand.mul(avgCost)

      return {
        productId: p.id,
        sku: p.code,
        barcode: p.barcode,
        name: p.name,
        category: p.category?.name || 'Uncategorized',
        unitOfMeasure: p.unitOfMeasure,
        unitCost: avgCost.toNumber(),
        salePrice: new Decimal(p.salePrice).toNumber(),
        onHand: onHand.toNumber(),
        reserved: reserved.toNumber(),
        available: available.toNumber(),
        totalValuation: totalValuation.toNumber(),
        warehouses: p.inventoryBalances.map((b) => ({
          warehouseId: b.warehouseId,
          warehouseName: b.warehouse.name,
          onHand: new Decimal(b.quantity).toNumber(),
          reserved: new Decimal(b.reservedQuantity).toNumber(),
          available: new Decimal(b.availableQuantity).toNumber(),
        })),
      }
    })
  }

  /**
   * 2. Stock by Warehouse Report.
   */
  static async getStockByWarehouseReport(businessId: string) {
    const warehouses = await prisma.warehouse.findMany({
      where: { businessId, isActive: true, deletedAt: null },
      include: {
        inventoryBalances: {
          include: { product: true },
        },
      },
    })

    return warehouses.map((wh) => {
      let totalUnits = new Decimal(0)
      let totalValuation = new Decimal(0)

      const items = wh.inventoryBalances.map((b) => {
        const qty = new Decimal(b.quantity)
        const cost = new Decimal(b.averageCost)
        const val = qty.mul(cost)
        totalUnits = totalUnits.plus(qty)
        totalValuation = totalValuation.plus(val)

        return {
          productId: b.productId,
          productName: b.product.name,
          productCode: b.product.code,
          onHand: qty.toNumber(),
          reserved: new Decimal(b.reservedQuantity).toNumber(),
          available: new Decimal(b.availableQuantity).toNumber(),
          averageCost: cost.toNumber(),
          totalValue: val.toNumber(),
        }
      })

      return {
        warehouseId: wh.id,
        warehouseName: wh.name,
        warehouseCode: wh.code,
        totalUnits: totalUnits.toNumber(),
        totalValuation: totalValuation.toNumber(),
        itemsCount: items.length,
        items,
      }
    })
  }

  /**
   * 3. Stock by Location/Bin Report.
   */
  static async getStockByLocationReport(businessId: string, warehouseId?: string) {
    const where: any = { businessId, deletedAt: null }
    if (warehouseId) where.warehouseId = warehouseId

    const locations = await prisma.warehouseLocation.findMany({
      where,
      include: {
        warehouse: true,
        locationBalances: { include: { product: true } },
      },
      orderBy: [{ warehouse: { name: 'asc' } }, { code: 'asc' }],
    })

    return locations.map((loc) => ({
      locationId: loc.id,
      locationCode: loc.code,
      locationName: loc.name,
      warehouseId: loc.warehouseId,
      warehouseName: loc.warehouse.name,
      aisle: loc.aisle,
      rack: loc.rack,
      shelf: loc.shelf,
      bin: loc.bin,
      zone: loc.zone,
      items: loc.locationBalances.map((b) => ({
        productId: b.productId,
        productName: b.product.name,
        productCode: b.product.code,
        onHand: new Decimal(b.quantity).toNumber(),
        reserved: new Decimal(b.reservedQuantity).toNumber(),
        available: new Decimal(b.availableQuantity).toNumber(),
      })),
    }))
  }

  /**
   * 4. Inventory Valuation Report (Quantity × WAC, Negative Stock & Cost Anomalies).
   */
  static async getInventoryValuationReport(
    businessId: string,
    options?: { asOfDate?: Date | string; warehouseId?: string }
  ) {
    const whereProduct: any = { businessId, trackInventory: true, isActive: true, deletedAt: null }

    const products = await prisma.product.findMany({
      where: whereProduct,
      include: {
        category: true,
        inventoryBalances: options?.warehouseId ? { where: { warehouseId: options.warehouseId }, include: { warehouse: true } } : { include: { warehouse: true } },
      },
      orderBy: { name: 'asc' },
    })

    let grandTotalQuantity = new Decimal(0)
    let grandTotalValuation = new Decimal(0)
    const negativeStockItems: any[] = []
    const costAnomalies: any[] = []

    const items = products.map((p) => {
      const onHand = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))
      const unitCost = new Decimal(p.costPrice || 0)
      const lineValuation = onHand.mul(unitCost)

      grandTotalQuantity = grandTotalQuantity.plus(onHand)
      grandTotalValuation = grandTotalValuation.plus(lineValuation)

      // Anomaly detection
      if (onHand.lt(0)) {
        negativeStockItems.push({
          productId: p.id,
          productName: p.name,
          onHand: onHand.toNumber(),
        })
      }
      if (unitCost.lte(0) && onHand.gt(0)) {
        costAnomalies.push({
          productId: p.id,
          productName: p.name,
          unitCost: unitCost.toNumber(),
          onHand: onHand.toNumber(),
          issue: 'Zero or missing cost price with positive stock',
        })
      }

      return {
        productId: p.id,
        sku: p.code,
        name: p.name,
        category: p.category?.name || 'Uncategorized',
        unitOfMeasure: p.unitOfMeasure,
        quantity: onHand.toNumber(),
        averageCost: unitCost.toNumber(),
        totalValuation: lineValuation.toNumber(),
        isNegativeStock: onHand.lt(0),
        warehouses: p.inventoryBalances.map((b) => ({
          warehouseId: b.warehouseId,
          warehouseName: b.warehouse.name,
          quantity: new Decimal(b.quantity).toNumber(),
          averageCost: new Decimal(b.averageCost).toNumber(),
          totalValuation: new Decimal(b.quantity).mul(new Decimal(b.averageCost)).toNumber(),
        })),
      }
    })

    return {
      asOfDate: options?.asOfDate ? new Date(options.asOfDate) : new Date(),
      totalProductsCount: products.length,
      grandTotalQuantity: grandTotalQuantity.toNumber(),
      grandTotalValuation: grandTotalValuation.toNumber(),
      negativeStockCount: negativeStockItems.length,
      negativeStockItems,
      costAnomaliesCount: costAnomalies.length,
      costAnomalies,
      items,
    }
  }

  /**
   * 5. Stock Movements Audit Report.
   */
  static async getStockMovementReport(
    businessId: string,
    filters?: { productId?: string; warehouseId?: string; fromDate?: Date | string; toDate?: Date | string }
  ) {
    const where: any = { businessId }
    if (filters?.productId) where.productId = filters.productId
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId
    if (filters?.fromDate || filters?.toDate) {
      where.movementDate = {}
      if (filters.fromDate) where.movementDate.gte = new Date(filters.fromDate)
      if (filters.toDate) where.movementDate.lte = new Date(filters.toDate)
    }

    return prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        location: true,
        batch: true,
        serial: true,
        creator: { select: { fullName: true, email: true } },
      },
      orderBy: { movementDate: 'desc' },
    })
  }

  /**
   * 6. Stock Count Variance Report.
   */
  static async getStockCountVarianceReport(businessId: string, stockCountId: string) {
    const count = await prisma.stockCount.findFirst({
      where: { id: stockCountId, businessId },
      include: {
        warehouse: true,
        items: { include: { product: true, location: true } },
      },
    })
    if (!count) throw new TenantAccessDeniedError('StockCount')

    const itemsWithVariance = count.items.map((i) => {
      const snap = new Decimal(i.snapshotQuantity)
      const actual = i.countedQuantity !== null ? new Decimal(i.countedQuantity) : null
      const varQty = actual !== null ? actual.minus(snap) : new Decimal(0)
      const cost = new Decimal(i.unitCost)
      const varVal = varQty.mul(cost)

      return {
        productId: i.productId,
        productName: i.product.name,
        productCode: i.product.code,
        locationCode: i.location?.code,
        snapshotQuantity: snap.toNumber(),
        countedQuantity: actual ? actual.toNumber() : null,
        varianceQuantity: varQty.toNumber(),
        unitCost: cost.toNumber(),
        varianceValue: varVal.toNumber(),
        varianceType: varQty.gt(0) ? 'gain' : varQty.lt(0) ? 'loss' : 'match',
      }
    })

    const totalGainValue = itemsWithVariance
      .filter((i) => i.varianceQuantity > 0)
      .reduce((sum, i) => sum + i.varianceValue, 0)

    const totalLossValue = itemsWithVariance
      .filter((i) => i.varianceQuantity < 0)
      .reduce((sum, i) => sum + Math.abs(i.varianceValue), 0)

    return {
      countId: count.id,
      countNumber: count.countNumber,
      status: count.status,
      warehouseName: count.warehouse.name,
      countDate: count.countDate,
      totalGainValue,
      totalLossValue,
      netVarianceValue: totalGainValue - totalLossValue,
      items: itemsWithVariance,
    }
  }

  /**
   * 7. Real-Time Inventory Dashboard KPIs.
   */
  static async getInventoryDashboardKPIs(businessId: string) {
    const [
      balances,
      products,
      pendingTransfers,
      pendingCounts,
      recentAdjustments,
      expiringBatches,
    ] = await Promise.all([
      prisma.inventoryBalance.findMany({ where: { businessId } }),
      prisma.product.findMany({ where: { businessId, trackInventory: true, isActive: true } }),
      prisma.stockTransfer.count({ where: { businessId, status: { in: ['draft', 'requested', 'approved', 'shipped'] } } }),
      prisma.stockCount.count({ where: { businessId, status: { in: ['draft', 'counting', 'review'] } } }),
      prisma.stockAdjustment.count({ where: { businessId, status: 'posted' } }),
      prisma.productBatch.count({
        where: {
          businessId,
          status: 'active',
          quantity: { gt: 0 },
          expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    const totalOnHand = balances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))
    const totalReserved = balances.reduce((sum, b) => sum.plus(new Decimal(b.reservedQuantity)), new Decimal(0))
    const totalAvailable = balances.reduce((sum, b) => sum.plus(new Decimal(b.availableQuantity)), new Decimal(0))
    const totalValuation = balances.reduce(
      (sum, b) => sum.plus(new Decimal(b.quantity).mul(new Decimal(b.averageCost))),
      new Decimal(0)
    )

    let lowStockCount = 0
    let outOfStockCount = 0

    for (const p of products) {
      const pBalances = balances.filter((b) => b.productId === p.id)
      const pOnHand = pBalances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))

      if (pOnHand.lte(0)) {
        outOfStockCount++
      } else if (p.reorderLevel && pOnHand.lte(new Decimal(p.reorderLevel))) {
        lowStockCount++
      }
    }

    return {
      totalValuation: totalValuation.toNumber(),
      onHandUnits: totalOnHand.toNumber(),
      reservedUnits: totalReserved.toNumber(),
      availableUnits: totalAvailable.toNumber(),
      lowStockItems: lowStockCount,
      outOfStockItems: outOfStockCount,
      expiringItems: expiringBatches,
      pendingTransfers,
      pendingStockCounts: pendingCounts,
      inventoryAdjustments: recentAdjustments,
    }
  }
}
