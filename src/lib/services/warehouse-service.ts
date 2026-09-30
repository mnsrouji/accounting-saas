// =============================================================
// Warehouse & Location Service — Bins, Locations & Transfers
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================
import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { AuditService } from './audit-service'
import { InsufficientStockError, TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export interface CreateLocationInput {
  warehouseId: string
  code: string
  name: string
  aisle?: string
  rack?: string
  shelf?: string
  bin?: string
  zone?: string
}

export interface CreateTransferItemInput {
  productId: string
  quantity: number | Decimal
  fromLocationId?: string
  toLocationId?: string
  notes?: string
}

export interface CreateTransferInput {
  fromWarehouseId: string
  toWarehouseId: string
  fromLocationId?: string
  toLocationId?: string
  transferDate?: Date | string
  items: CreateTransferItemInput[]
  notes?: string
  status?: 'draft' | 'requested'
}

export class WarehouseService {
  // ==========================================
  // WAREHOUSE LOCATIONS & BINS
  // ==========================================

  static async createLocation(businessId: string, input: CreateLocationInput, userId?: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, businessId },
    })
    if (!warehouse) throw new TenantAccessDeniedError('Warehouse')

    const existing = await prisma.warehouseLocation.findFirst({
      where: { businessId, warehouseId: input.warehouseId, code: input.code },
    })
    if (existing) {
      throw new ValidationError(`Location code "${input.code}" already exists in this warehouse`)
    }

    const location = await prisma.warehouseLocation.create({
      data: {
        businessId,
        warehouseId: input.warehouseId,
        code: input.code,
        name: input.name,
        aisle: input.aisle,
        rack: input.rack,
        shelf: input.shelf,
        bin: input.bin,
        zone: input.zone,
        isActive: true,
      },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'create',
        entityType: 'warehouse_location',
        entityId: location.id,
        newValues: { code: input.code, warehouseId: input.warehouseId },
      })
    }

    return location
  }

  static async updateLocation(
    businessId: string,
    locationId: string,
    input: Partial<CreateLocationInput> & { isActive?: boolean },
    userId?: string
  ) {
    const loc = await prisma.warehouseLocation.findFirst({
      where: { id: locationId, businessId },
    })
    if (!loc) throw new TenantAccessDeniedError('WarehouseLocation')

    const updated = await prisma.warehouseLocation.update({
      where: { id: locationId },
      data: {
        name: input.name ?? loc.name,
        code: input.code ?? loc.code,
        aisle: input.aisle ?? loc.aisle,
        rack: input.rack ?? loc.rack,
        shelf: input.shelf ?? loc.shelf,
        bin: input.bin ?? loc.bin,
        zone: input.zone ?? loc.zone,
        isActive: input.isActive ?? loc.isActive,
      },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'warehouse_location',
        entityId: locationId,
        newValues: input,
      })
    }

    return updated
  }

  static async getLocations(businessId: string, warehouseId?: string) {
    const where: any = { businessId, deletedAt: null }
    if (warehouseId) where.warehouseId = warehouseId

    return prisma.warehouseLocation.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        locationBalances: {
          include: { product: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: [{ warehouse: { name: 'asc' } }, { code: 'asc' }],
    })
  }

  static async getLocationStock(businessId: string, warehouseId: string, locationId: string) {
    return prisma.inventoryLocationBalance.findMany({
      where: { businessId, warehouseId, locationId },
      include: {
        product: true,
        location: true,
        warehouse: true,
      },
    })
  }

  // ==========================================
  // INTER-WAREHOUSE TRANSFERS WORKFLOW
  // ==========================================

  /**
   * Create a Stock Transfer in 'draft' or 'requested' status.
   */
  static async createTransfer(businessId: string, input: CreateTransferInput, userId?: string) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ValidationError('Source and destination warehouse cannot be identical for inter-warehouse transfer')
    }

    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Transfer must include at least one item')
    }

    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: input.fromWarehouseId, businessId } }),
      prisma.warehouse.findFirst({ where: { id: input.toWarehouseId, businessId } }),
    ])

    if (!fromWh || !toWh) throw new TenantAccessDeniedError('Warehouse')

    return prisma.$transaction(async (tx) => {
      const transferNumber = await DocumentNumberingService.generateNumber(businessId, 'stock_transfer', tx)
      const transferDate = input.transferDate ? new Date(input.transferDate) : new Date()

      // Calculate unit costs and prepare items
      const itemsData = []
      for (const item of input.items) {
        const qty = new Decimal(item.quantity)
        if (qty.lte(0)) throw new ValidationError('Transfer quantity must be greater than zero')

        const product = await tx.product.findFirst({ where: { id: item.productId, businessId } })
        if (!product) throw new TenantAccessDeniedError('Product')

        const unitCost = new Decimal(product.costPrice || 0)
        const totalCost = qty.mul(unitCost)

        itemsData.push({
          productId: item.productId,
          fromLocationId: item.fromLocationId || input.fromLocationId,
          toLocationId: item.toLocationId || input.toLocationId,
          quantity: qty,
          shippedQuantity: new Decimal(0),
          receivedQuantity: new Decimal(0),
          unitCost,
          totalCost,
          notes: item.notes,
        })
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          businessId,
          transferNumber,
          transferDate,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          status: input.status || 'draft',
          requestDate: input.status === 'requested' ? new Date() : null,
          requestedBy: input.status === 'requested' ? userId : null,
          notes: input.notes,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: { include: { product: true, fromLocation: true, toLocation: true } },
          fromWarehouse: true,
          toWarehouse: true,
        },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'create',
          entityType: 'stock_transfer',
          entityId: transfer.id,
          newValues: { transferNumber, status: transfer.status },
        }, tx)
      }

      return transfer
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Request approval for a draft transfer.
   */
  static async requestTransfer(businessId: string, transferId: string, userId?: string) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, businessId },
    })
    if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
    if (transfer.status !== 'draft') {
      throw new ValidationError(`Transfer cannot be requested from status "${transfer.status}"`)
    }

    const updated = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'requested',
        requestDate: new Date(),
        requestedBy: userId,
      },
      include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'stock_transfer',
        entityId: transferId,
        newValues: { status: 'requested' },
      })
    }

    return updated
  }

  /**
   * Approve a requested transfer.
   */
  static async approveTransfer(businessId: string, transferId: string, userId?: string) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, businessId },
    })
    if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
    if (transfer.status !== 'requested' && transfer.status !== 'draft') {
      throw new ValidationError(`Transfer cannot be approved from status "${transfer.status}"`)
    }

    const updated = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'approved',
        approvedDate: new Date(),
        approvedBy: userId,
      },
      include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'update',
        entityType: 'stock_transfer',
        entityId: transferId,
        newValues: { status: 'approved' },
      })
    }

    return updated
  }

  /**
   * Ship the approved transfer: Deducts stock from source warehouse and records transfer_out movement.
   */
  static async shipTransfer(businessId: string, transferId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id: transferId, businessId },
        include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      })

      if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
      if (transfer.status !== 'approved') {
        throw new ValidationError(`Transfer must be approved before shipment (current status: "${transfer.status}")`)
      }

      for (const item of transfer.items) {
        const qty = new Decimal(item.quantity)

        // 1. Issue stock from source warehouse
        const { currentAvgCost } = await InventoryService.issueStock(
          businessId,
          item.productId,
          transfer.fromWarehouseId,
          qty,
          tx
        )

        // Update location balance if source location exists
        if (item.fromLocationId) {
          const locBal = await tx.inventoryLocationBalance.findUnique({
            where: {
              businessId_warehouseId_locationId_productId: {
                businessId,
                warehouseId: transfer.fromWarehouseId,
                locationId: item.fromLocationId,
                productId: item.productId,
              },
            },
          })
          if (locBal) {
            const newLocQty = Decimal.max(0, new Decimal(locBal.quantity).minus(qty))
            await tx.inventoryLocationBalance.update({
              where: { id: locBal.id },
              data: {
                quantity: newLocQty,
                availableQuantity: Decimal.max(0, newLocQty.minus(new Decimal(locBal.reservedQuantity))),
              },
            })
          }
        }

        // 2. Record transfer_out movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
            locationId: item.fromLocationId,
            movementType: 'transfer_out',
            quantity: qty.negated(),
            unitCost: currentAvgCost,
            totalCost: qty.mul(currentAvgCost),
            referenceType: 'transfer',
            referenceId: transfer.id,
            createdBy: userId,
          },
        })

        // Update item shipped quantity and actual cost
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            shippedQuantity: qty,
            unitCost: currentAvgCost,
            totalCost: qty.mul(currentAvgCost),
          },
        })
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'shipped',
          shippedDate: new Date(),
          shippedBy: userId,
        },
        include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'update',
          entityType: 'stock_transfer',
          entityId: transferId,
          newValues: { status: 'shipped' },
        }, tx)
      }

      return updated
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Receive the shipped transfer: Adds stock to destination warehouse with WAC and records transfer_in movement.
   */
  static async receiveTransfer(businessId: string, transferId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id: transferId, businessId },
        include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      })

      if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
      if (transfer.status !== 'shipped') {
        throw new ValidationError(`Transfer must be shipped before receipt (current status: "${transfer.status}")`)
      }

      for (const item of transfer.items) {
        const qty = new Decimal(item.quantity)
        const unitCost = new Decimal(item.unitCost)

        // 1. Receive stock into destination warehouse using WAC
        await InventoryService.recalculateWAC(
          businessId,
          item.productId,
          transfer.toWarehouseId,
          qty,
          unitCost,
          tx
        )

        // Update destination location balance if specified
        if (item.toLocationId) {
          const locBal = await tx.inventoryLocationBalance.findUnique({
            where: {
              businessId_warehouseId_locationId_productId: {
                businessId,
                warehouseId: transfer.toWarehouseId,
                locationId: item.toLocationId,
                productId: item.productId,
              },
            },
          })
          const currentLocQty = locBal ? new Decimal(locBal.quantity) : new Decimal(0)
          const newLocQty = currentLocQty.plus(qty)

          await tx.inventoryLocationBalance.upsert({
            where: {
              businessId_warehouseId_locationId_productId: {
                businessId,
                warehouseId: transfer.toWarehouseId,
                locationId: item.toLocationId,
                productId: item.productId,
              },
            },
            update: {
              quantity: newLocQty,
              availableQuantity: newLocQty.minus(new Decimal(locBal?.reservedQuantity || 0)),
            },
            create: {
              businessId,
              warehouseId: transfer.toWarehouseId,
              locationId: item.toLocationId,
              productId: item.productId,
              quantity: newLocQty,
              reservedQuantity: new Decimal(0),
              availableQuantity: newLocQty,
            },
          })
        }

        // 2. Record transfer_in movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            locationId: item.toLocationId,
            movementType: 'transfer_in',
            quantity: qty,
            unitCost: unitCost,
            totalCost: qty.mul(unitCost),
            referenceType: 'transfer',
            referenceId: transfer.id,
            createdBy: userId,
          },
        })

        // Update item received quantity
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: qty,
          },
        })
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'received',
          receivedDate: new Date(),
          receivedBy: userId,
        },
        include: { items: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      })

      if (userId) {
        await AuditService.log({
          businessId,
          userId,
          action: 'update',
          entityType: 'stock_transfer',
          entityId: transferId,
          newValues: { status: 'received' },
        }, tx)
      }

      return updated
    }, { timeout: 30000, maxWait: 10000 })
  }

  /**
   * Cancel a transfer before it is shipped.
   */
  static async cancelTransfer(businessId: string, transferId: string, userId?: string) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, businessId },
    })
    if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
    if (transfer.status === 'shipped' || transfer.status === 'received') {
      throw new ValidationError(`Cannot cancel a transfer that is already ${transfer.status}`)
    }

    const updated = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'cancelled' },
    })

    if (userId) {
      await AuditService.log({
        businessId,
        userId,
        action: 'cancel',
        entityType: 'stock_transfer',
        entityId: transferId,
        newValues: { status: 'cancelled' },
      })
    }

    return updated
  }

  static async getTransfer(businessId: string, transferId: string) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, businessId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        fromLocation: true,
        toLocation: true,
        items: {
          include: {
            product: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    })
    if (!transfer) throw new TenantAccessDeniedError('StockTransfer')
    return transfer
  }

  static async listTransfers(businessId: string, filters?: { status?: string; warehouseId?: string }) {
    const where: any = { businessId }
    if (filters?.status) where.status = filters.status
    if (filters?.warehouseId) {
      where.OR = [
        { fromWarehouseId: filters.warehouseId },
        { toWarehouseId: filters.warehouseId },
      ]
    }

    return prisma.stockTransfer.findMany({
      where,
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
