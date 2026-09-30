import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { PurchaseInvoiceForm } from './PurchaseInvoiceForm'

export const metadata: Metadata = {
  title: 'New Purchase Bill | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NewPurchaseInvoicePage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [suppliers, products, warehouses] = await Promise.all([
    prisma.supplier.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true, costPrice: true },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <PurchaseInvoiceForm
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      suppliers={suppliers.map((s) => ({ ...s, currency: s.currency || 'USD' }))}
      products={products.map((p) => ({ ...p, sku: p.code || '', costPrice: Number(p.costPrice) }))}
      warehouses={warehouses.map((w) => ({ ...w, code: w.code || '' }))}
    />
  )
}
