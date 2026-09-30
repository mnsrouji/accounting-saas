// =============================================================
// Stock Reservation Service — Sales Order Allocation & Availability
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { InsufficientStockError, TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'

export interface CreateReservationInput {
  salesOrderId?: string
  salesOrderItemId?: string
  productId: string
  warehouseId: string
  locationId?: string
  quantity: number | Decimal
  notes?: string
}

export class StockReservationService {
  /**
   * Get complete stock breakdown for a product: On Hand, Reserved, Available, and Ordered (in PO pipeline).
   */
  static async getProductStockBreakdown(businessId: string, productId: string, warehouseId?: string) {
    const whereBalance: any = { businessId, productId }
    if (warehouseId) whereBalance.warehouseId = warehouseId

    const balances = await prisma.inventoryBalance.findMany({
      where: whereBalance,
    })

    const onHand = balances.reduce((sum, b) => sum.plus(new Decimal(b.quantity)), new Decimal(0))
    const reserved = balances.reduce((sum, b) => sum.plus(new Decimal(b.reservedQuantity)), new Decimal(0))
    const available = balances.reduce((sum, b) => sum.plus(new Decimal(b.availableQuantity)), new Decimal(0))

    // Calculate Ordered Quantity from pending purchase orders
    const wherePOItems: any = {
      productId,
      purchaseOrder: {
        businessId,
        status: { in: ['draft', 'confirmed', 'processing'] },
      },
    }
    if (warehouseId) wherePOItems.warehouseId = warehouseId

    const poItems = await prisma.purchaseOrderItem.findMany({
      where: wherePOItems,
      select: { quantity: true },
    })

    const ordered = poItems.reduce((sum, item) => sum.plus(new Decimal(item.quantity)), new Decimal(0))

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { minStock: true, maxStock: true, reorderLevel: true, reorderQuantity: true, costPrice: true },
    })

    return {
      productId,
      warehouseId: warehouseId || null,
      onHand: onHand.toNumber(),
      reserved: reserved.toNumber(),
      available: available.toNumber(),
      ordered: ordered.toNumber(),
      reorderPoint: product?.reorderLevel ? new Decimal(product.reorderLevel).toNumber() : 0,
      reorderQuantity: product?.reorderQuantity ? new Decimal(product.reorderQuantity).toNumber() : 0,
      minStock: product?.minStock ? new Decimal(product.minStock).toNumber() : 0,
      maxStock: product?.maxStock ? new Decimal(product.maxStock).toNumber() : 0,
    }
  }

  /**
   * Reserve stock explicitly for a single line item or product.
   */
  static async reserveStock(businessId: string, input: CreateReservationInput, userId?: string, tx?: any) {
    const client = tx ?? prisma
    const qty = new Decimal(input.quantity)
    if (qty.lte(0)) {
      throw new ValidationError('Reservation quantity must be greater than zero')
    }

    const product = await client.product.findFirst({
      where: { id: input.productId, businessId },
    })
    if (!product) throw new TenantAccessDeniedError('Product')

    // Find or create InventoryBalance
    const balance = await client.inventoryBalance.findUnique({
      where: {
        businessId_productId_warehouseId: {
          businessId,
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    })

    const currentOnHand = balance ? new Decimal(balance.quantity) : new Decimal(0)
    const currentReserved = balance ? new Decimal(balance.reservedQuantity) : new Decimal(0)
    const currentAvailable = balance ? new Decimal(balance.availableQuantity) : currentOnHand.minus(currentReserved)

    if (currentAvailable.lt(qty)) {
      throw new InsufficientStockError(
        product.name,
        qty.toNumber(),
        currentAvailable.toNumber()
      )
    }

    // Check if item already has active reservation to prevent double allocation
    if (input.salesOrderItemId) {
      const existingActive = await client.stockReservation.findFirst({
        where: {
          businessId,
          salesOrderItemId: input.salesOrderItemId,
          status: 'active',
        },
      })
      if (existingActive) {
        throw new ValidationError(`Sales order item already has an active stock reservation (${existingActive.id})`)
      }
    }

    const newReserved = currentReserved.plus(qty)
    const newAvailable = currentOnHand.minus(newReserved)

    // Update InventoryBalance
    await client.inventoryBalance.upsert({
      where: {
        businessId_productId_warehouseId: {
          businessId,
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      update: {
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
      },
      create: {
        businessId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: currentOnHand,
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
        averageCost: product.costPrice,
      },
    })

    // Update location balance if location specified
    if (input.locationId) {
      const locBalance = await client.inventoryLocationBalance.findUnique({
        where: {
          businessId_warehouseId_locationId_productId: {
            businessId,
            warehouseId: input.warehouseId,
            locationId: input.locationId,
            productId: input.productId,
          },
        },
      })
      const locOnHand = locBalance ? new Decimal(locBalance.quantity) : new Decimal(0)
      const locReserved = locBalance ? new Decimal(locBalance.reservedQuantity) : new Decimal(0)
      const locNewReserved = locReserved.plus(qty)
      const locNewAvailable = locOnHand.minus(locNewReserved)

      await client.inventoryLocationBalance.upsert({
        where: {
          businessId_warehouseId_locationId_productId: {
            businessId,
            warehouseId: input.warehouseId,
            locationId: input.locationId,
            productId: input.productId,
          },
        },
        update: {
          reservedQuantity: locNewReserved,
          availableQuantity: locNewAvailable,
        },
        create: {
          businessId,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          productId: input.productId,
          quantity: locOnHand,
          reservedQuantity: locNewReserved,
          availableQuantity: locNewAvailable,
        },
      })
    }

    // Create Reservation record
    const reservation = await client.stockReservation.create({
      data: {
        businessId,
        salesOrderId: input.salesOrderId,
        salesOrderItemId: input.salesOrderItemId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        reservedQuantity: qty,
        consumedQuantity: new Decimal(0),
        status: 'active',
        notes: input.notes,
        createdBy: userId,
      },
      include: {
        product: true,
        warehouse: true,
        location: true,
      },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'create',
        entityType: 'stock_reservation',
        entityId: reservation.id,
        newValues: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: qty.toNumber(),
          salesOrderId: input.salesOrderId,
        },
      }, client)
    }

    return reservation
  }

  /**
   * Automatically reserve stock for an entire Sales Order.
   */
  static async reserveStockForSalesOrder(businessId: string, salesOrderId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: salesOrderId, businessId },
        include: { items: { include: { product: true } } },
      })

      if (!salesOrder) throw new TenantAccessDeniedError('SalesOrder')
      if (!salesOrder.warehouseId) {
        throw new ValidationError('Sales Order must specify a warehouse for stock reservation')
      }

      const createdReservations = []

      for (const item of salesOrder.items) {
        if (!item.productId) continue
        const itemWarehouseId = item.warehouseId || salesOrder.warehouseId

        const res = await this.reserveStock(
          businessId,
          {
            salesOrderId: salesOrder.id,
            salesOrderItemId: item.id,
            productId: item.productId,
            warehouseId: itemWarehouseId,
            quantity: item.quantity,
            notes: `Auto-reservation for Sales Order ${salesOrder.orderNumber}`,
          },
          userId,
          tx
        )
        createdReservations.push(res)
      }

      return createdReservations
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Release a stock reservation back to available stock.
   */
  static async releaseReservation(businessId: string, reservationId: string, userId?: string, tx?: any) {
    const client = tx ?? prisma

    const reservation = await client.stockReservation.findFirst({
      where: { id: reservationId, businessId },
    })

    if (!reservation) throw new TenantAccessDeniedError('StockReservation')
    if (reservation.status === 'released' || reservation.status === 'consumed') {
      return reservation // Already released or consumed
    }

    const unconsumedQty = new Decimal(reservation.reservedQuantity).minus(new Decimal(reservation.consumedQuantity))

    if (unconsumedQty.gt(0)) {
      // Update inventory balance
      const balance = await client.inventoryBalance.findUnique({
        where: {
          businessId_productId_warehouseId: {
            businessId,
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
      })

      if (balance) {
        const currentReserved = new Decimal(balance.reservedQuantity)
        const newReserved = Decimal.max(0, currentReserved.minus(unconsumedQty))
        const onHand = new Decimal(balance.quantity)
        const newAvailable = onHand.minus(newReserved)

        await client.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            reservedQuantity: newReserved,
            availableQuantity: newAvailable,
          },
        })
      }

      // Update location balance if any
      if (reservation.locationId) {
        const locBalance = await client.inventoryLocationBalance.findUnique({
          where: {
            businessId_warehouseId_locationId_productId: {
              businessId,
              warehouseId: reservation.warehouseId,
              locationId: reservation.locationId,
              productId: reservation.productId,
            },
          },
        })

        if (locBalance) {
          const locReserved = new Decimal(locBalance.reservedQuantity)
          const newLocReserved = Decimal.max(0, locReserved.minus(unconsumedQty))
          const locOnHand = new Decimal(locBalance.quantity)
          const newLocAvailable = locOnHand.minus(newLocReserved)

          await client.inventoryLocationBalance.update({
            where: { id: locBalance.id },
            data: {
              reservedQuantity: newLocReserved,
              availableQuantity: newLocAvailable,
            },
          })
        }
      }
    }

    const updated = await client.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'released' },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'stock_reservation',
        entityId: reservationId,
        newValues: { status: 'released', releasedQty: unconsumedQty.toNumber() },
      }, client)
    }

    return updated
  }

  /**
   * Release all active reservations for a given Sales Order.
   */
  static async releaseSalesOrderReservations(businessId: string, salesOrderId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { businessId, salesOrderId, status: 'active' },
      })

      for (const res of reservations) {
        await this.releaseReservation(businessId, res.id, userId, tx)
      }

      return { releasedCount: reservations.length }
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Consume a reservation during delivery confirmation.
   */
  static async consumeReservation(
    businessId: string,
    params: {
      salesOrderId?: string
      salesOrderItemId?: string
      productId: string
      warehouseId: string
      quantity: Decimal | number
    },
    tx: any
  ) {
    const qtyToConsume = new Decimal(params.quantity)
    if (qtyToConsume.lte(0)) return

    // Find active reservations matching the criteria
    const whereClause: any = {
      businessId,
      productId: params.productId,
      warehouseId: params.warehouseId,
      status: { in: ['active', 'partially_consumed'] },
    }

    if (params.salesOrderItemId) {
      whereClause.salesOrderItemId = params.salesOrderItemId
    } else if (params.salesOrderId) {
      whereClause.salesOrderId = params.salesOrderId
    }

    const reservations = await tx.stockReservation.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    })

    let remainingToConsume = qtyToConsume

    for (const res of reservations) {
      if (remainingToConsume.lte(0)) break

      const resRemaining = new Decimal(res.reservedQuantity).minus(new Decimal(res.consumedQuantity))
      if (resRemaining.lte(0)) continue

      const consumeFromThis = Decimal.min(remainingToConsume, resRemaining)
      const newConsumed = new Decimal(res.consumedQuantity).plus(consumeFromThis)
      const isFullyConsumed = newConsumed.gte(new Decimal(res.reservedQuantity))

      await tx.stockReservation.update({
        where: { id: res.id },
        data: {
          consumedQuantity: newConsumed,
          status: isFullyConsumed ? 'consumed' : 'partially_consumed',
        },
      })

      // Decrement reservedQuantity from InventoryBalance
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          businessId_productId_warehouseId: {
            businessId,
            productId: params.productId,
            warehouseId: params.warehouseId,
          },
        },
      })

      if (balance) {
        const onHand = new Decimal(balance.quantity)
        const newReserved = Decimal.max(0, new Decimal(balance.reservedQuantity).minus(consumeFromThis))
        const newAvailable = onHand.minus(newReserved)
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            reservedQuantity: newReserved,
            availableQuantity: newAvailable,
          },
        })
      }

      remainingToConsume = remainingToConsume.minus(consumeFromThis)
    }
  }

  /**
   * Get all reservations for a specific sales order.
   */
  static async getReservationsBySalesOrder(businessId: string, salesOrderId: string) {
    return prisma.stockReservation.findMany({
      where: { businessId, salesOrderId },
      include: {
        product: true,
        warehouse: true,
        location: true,
        salesOrderItem: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  }
}
