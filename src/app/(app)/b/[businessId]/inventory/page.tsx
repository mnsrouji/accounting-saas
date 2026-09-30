import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { InventoryListClient, type ProductRow, type WarehouseRow } from './InventoryListClient'
import Decimal from 'decimal.js'

export const metadata: Metadata = {
  title: 'Inventory & Warehouses | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function InventoryPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [products, warehouses, inventoryBalances, rawAccounts] = await Promise.all([
    prisma.product.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryBalance.findMany({
      where: { businessId },
      include: { product: true, warehouse: true },
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        isHeader: true,
        isActive: true,
      },
    }),
  ])

  const glAccounts = rawAccounts.map((acc) => ({
    id: acc.id,
    code: acc.code,
    name: acc.name,
    type: acc.type,
    isHeader: acc.isHeader,
    isActive: acc.isActive,
  }))

  // Calculate product table data with total stock & inventory valuation
  const productData: ProductRow[] = products.map((prod) => {
    const balances = inventoryBalances.filter((b) => b.productId === prod.id)
    let totalQty = new Decimal(0)
    let totalValue = new Decimal(0)

    balances.forEach((b) => {
      const q = new Decimal(b.quantity.toString())
      const c = new Decimal(b.averageCost.toString())
      totalQty = totalQty.plus(q)
      totalValue = totalValue.plus(q.mul(c))
    })

    return {
      id: prod.id,
      sku: prod.code || '—',
      name: prod.name,
      productType: prod.productType,
      unitOfMeasure: prod.unitOfMeasure || 'قطعة',
      salePrice: Number(prod.salePrice),
      costPrice: Number(prod.costPrice),
      totalQuantity: totalQty.toNumber(),
      totalValue: totalValue.toNumber(),
      trackInventory: prod.trackInventory,
      currencyCode: business.defaultCurrency,
    }
  })

  const warehouseData: WarehouseRow[] = warehouses.map((wh) => {
    const whBalances = inventoryBalances.filter((b) => b.warehouseId === wh.id)
    let whTotalValue = new Decimal(0)
    whBalances.forEach((b) => {
      whTotalValue = whTotalValue.plus(new Decimal(b.quantity.toString()).mul(new Decimal(b.averageCost.toString())))
    })

    return {
      id: wh.id,
      code: wh.code || '',
      name: wh.name,
      totalValue: whTotalValue.toNumber(),
      lineItemCount: whBalances.length,
    }
  })

  return (
    <InventoryListClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      products={productData}
      warehouses={warehouseData}
      glAccounts={glAccounts}
    />
  )
}


