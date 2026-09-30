import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { WarehousesClient, type WarehouseDetailRow } from './WarehousesClient'
import Decimal from 'decimal.js'

export const metadata: Metadata = {
  title: 'Warehouse Management | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function WarehousesPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [warehouses, inventoryBalances] = await Promise.all([
    prisma.warehouse.findMany({
      where: { businessId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            inventoryMovements: true,
            locations: true,
          },
        },
      },
    }),
    prisma.inventoryBalance.findMany({
      where: { businessId },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            salePrice: true,
            costPrice: true,
            productType: true,
          },
        },
      },
    }),
  ])

  const warehouseRows: WarehouseDetailRow[] = warehouses.map((wh) => {
    const balances = inventoryBalances.filter((b) => b.warehouseId === wh.id)
    let totalQty = new Decimal(0)
    let totalValuation = new Decimal(0)

    const items = balances.map((b) => {
      const q = new Decimal(b.quantity.toString())
      const c = new Decimal(b.averageCost.toString())
      totalQty = totalQty.plus(q)
      totalValuation = totalValuation.plus(q.mul(c))

      return {
        productId: b.productId,
        productName: b.product.name,
        productSku: b.product.code || '—',
        quantity: q.toNumber(),
        averageCost: c.toNumber(),
        totalValue: q.mul(c).toNumber(),
      }
    })

    return {
      id: wh.id,
      code: wh.code || '',
      name: wh.name,
      location: wh.location || '',
      address: wh.address || '',
      isDefault: wh.isDefault,
      isActive: wh.isActive,
      totalQuantity: totalQty.toNumber(),
      totalValuation: totalValuation.toNumber(),
      uniqueItemCount: balances.length,
      movementCount: wh._count.inventoryMovements,
      locationCount: wh._count.locations,
      createdAt: wh.createdAt.toISOString(),
      items,
    }
  })

  return (
    <WarehousesClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      warehouses={warehouseRows}
    />
  )
}
