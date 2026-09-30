// =============================================================
// Reorder & Stock Planning Service — Automated Replenishment & Alerts
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'

export interface UpdateProductPolicyInput {
  minStock?: number | Decimal | null
  maxStock?: number | Decimal | null
  reorderLevel?: number | Decimal | null // reorderPoint
  reorderQuantity?: number | Decimal | null
  safetyStock?: number | Decimal | null
  leadTimeDays?: number | null
  preferredSupplierId?: string | null
}

export interface ReplenishmentItem {
  productId: string
  productCode: string | null
  productName: string
  unitOfMeasure: string
  costPrice: number
  onHand: number
  reserved: number
  available: number
  ordered: number
  effectiveStock: number // available + ordered
  minStock: number | null
  maxStock: number | null
  reorderPoint: number | null
  reorderQuantity: number | null
  safetyStock: number | null
  leadTimeDays: number | null
  preferredSupplier: { id: string; name: string; email?: string | null } | null
  status: 'out_of_stock' | 'below_reorder_point' | 'low_stock' | 'optimal' | 'overstocked'
  suggestedPurchaseQuantity: number
}

export class ReorderPlanningService {
  /**
   * Update replenishment & inventory planning policies for a product.
   */
  static async updateProductPolicy(
    businessId: string,
    productId: string,
    policy: UpdateProductPolicyInput,
    userId?: string
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    })
    if (!product) throw new TenantAccessDeniedError('Product')

    if (policy.preferredSupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: policy.preferredSupplierId, businessId },
      })
      if (!supplier) throw new TenantAccessDeniedError('Supplier')
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        minStock: policy.minStock !== undefined ? (policy.minStock !== null ? new Decimal(policy.minStock) : null) : undefined,
        maxStock: policy.maxStock !== undefined ? (policy.maxStock !== null ? new Decimal(policy.maxStock) : null) : undefined,
        reorderLevel: policy.reorderLevel !== undefined ? (policy.reorderLevel !== null ? new Decimal(policy.reorderLevel) : null) : undefined,
        reorderQuantity: policy.reorderQuantity !== undefined ? (policy.reorderQuantity !== null ? new Decimal(policy.reorderQuantity) : null) : undefined,
        safetyStock: policy.safetyStock !== undefined ? (policy.safetyStock !== null ? new Decimal(policy.safetyStock) : null) : undefined,
        leadTimeDays: policy.leadTimeDays !== undefined ? policy.leadTimeDays : undefined,
        preferredSupplierId: policy.preferredSupplierId !== undefined ? policy.preferredSupplierId : undefined,
      },
      include: { preferredSupplier: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'product_policy',
        entityId: productId,
        newValues: policy,
      })
    }

    return updated
  }

  /**
   * Generate comprehensive replenishment planning report across products.
   */
  static async getReplenishmentPlan(
    businessId: string,
    filters?: { warehouseId?: string; categoryId?: string; supplierId?: string }
  ): Promise<ReplenishmentItem[]> {
    const whereProduct: any = {
      businessId,
      trackInventory: true,
      isActive: true,
      deletedAt: null,
    }

    if (filters?.categoryId) whereProduct.categoryId = filters.categoryId
    if (filters?.supplierId) whereProduct.preferredSupplierId = filters.supplierId

    const products = await prisma.product.findMany({
      where: whereProduct,
      include: {
        preferredSupplier: { select: { id: true, name: true, email: true } },
        inventoryBalances: filters?.warehouseId ? { where: { warehouseId: filters.warehouseId } } : true,
      },
      orderBy: { name: 'asc' },
    })

    // Fetch all pending PO quantities grouped by product
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        purchaseOrder: {
          businessId,
          status: { in: ['draft', 'confirmed', 'processing'] },
        },
      },
      select: { productId: true, quantity: true },
    })

    const poMap = new Map<string, Decimal>()
    for (const item of poItems) {
      if (!item.productId) continue
      const qty = new Decimal(item.quantity)
      if (qty.gt(0)) {
        const curr = poMap.get(item.productId) || new Decimal(0)
        poMap.set(item.productId, curr.plus(qty))
      }
    }

    const plan: ReplenishmentItem[] = []

    for (const p of products) {
      const onHand = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))
      const reserved = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.reservedQuantity)), new Decimal(0))
      const available = p.inventoryBalances.reduce((sum, b) => sum.plus(new Decimal(b.availableQuantity)), new Decimal(0))
      const ordered = poMap.get(p.id) || new Decimal(0)
      const effectiveStock = available.plus(ordered)

      const minStock = p.minStock ? new Decimal(p.minStock).toNumber() : null
      const maxStock = p.maxStock ? new Decimal(p.maxStock).toNumber() : null
      const reorderPoint = p.reorderLevel ? new Decimal(p.reorderLevel).toNumber() : null
      const reorderQty = p.reorderQuantity ? new Decimal(p.reorderQuantity).toNumber() : null
      const safetyStock = p.safetyStock ? new Decimal(p.safetyStock).toNumber() : null
      const leadTimeDays = p.leadTimeDays ?? null

      let status: 'out_of_stock' | 'below_reorder_point' | 'low_stock' | 'optimal' | 'overstocked' = 'optimal'
      let suggestedPurchaseQuantity = 0

      const threshold = reorderPoint ?? minStock ?? 0

      if (onHand.lte(0)) {
        status = 'out_of_stock'
      } else if (reorderPoint !== null && effectiveStock.lte(reorderPoint)) {
        status = 'below_reorder_point'
      } else if (minStock !== null && onHand.lte(minStock)) {
        status = 'low_stock'
      } else if (maxStock !== null && effectiveStock.gt(maxStock)) {
        status = 'overstocked'
      }

      // Calculate suggested purchase quantity
      if (status === 'out_of_stock' || status === 'below_reorder_point' || status === 'low_stock') {
        if (reorderQty && reorderQty > 0) {
          suggestedPurchaseQuantity = reorderQty
        } else if (maxStock && maxStock > 0) {
          suggestedPurchaseQuantity = Math.max(0, maxStock - effectiveStock.toNumber())
        } else {
          const target = threshold + (safetyStock || 0)
          suggestedPurchaseQuantity = Math.max(0, target - effectiveStock.toNumber())
        }
      }

      plan.push({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        unitOfMeasure: p.unitOfMeasure,
        costPrice: new Decimal(p.costPrice).toNumber(),
        onHand: onHand.toNumber(),
        reserved: reserved.toNumber(),
        available: available.toNumber(),
        ordered: ordered.toNumber(),
        effectiveStock: effectiveStock.toNumber(),
        minStock,
        maxStock,
        reorderPoint,
        reorderQuantity: reorderQty,
        safetyStock,
        leadTimeDays,
        preferredSupplier: p.preferredSupplier,
        status,
        suggestedPurchaseQuantity,
      })
    }

    return plan
  }

  /**
   * Get operational stock alerts for dashboard & management.
   */
  static async getInventoryAlerts(businessId: string) {
    const plan = await this.getReplenishmentPlan(businessId)

    const outOfStockItems = plan.filter((i) => i.status === 'out_of_stock')
    const belowReorderItems = plan.filter((i) => i.status === 'below_reorder_point')
    const lowStockItems = plan.filter((i) => i.status === 'low_stock')
    const overstockedItems = plan.filter((i) => i.status === 'overstocked')

    return {
      totalMonitoredProducts: plan.length,
      outOfStockCount: outOfStockItems.length,
      belowReorderCount: belowReorderItems.length,
      lowStockCount: lowStockItems.length,
      overstockedCount: overstockedItems.length,
      outOfStockItems,
      belowReorderItems,
      lowStockItems,
      overstockedItems,
    }
  }
}
