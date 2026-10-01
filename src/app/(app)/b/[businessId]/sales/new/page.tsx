import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { SalesInvoiceForm } from './SalesInvoiceForm'

export const metadata: Metadata = {
  title: 'New Sales Invoice | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NewSalesInvoicePage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [customers, products, warehouses, cashAccounts, bankAccounts] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true, salePrice: true, productType: true },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true, currencyCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, accountName: true, bankName: true, code: true, currencyCode: true },
      orderBy: { accountName: 'asc' },
    }),
  ])

  const treasuryAccounts = [
    ...cashAccounts.map((c) => ({
      id: c.id,
      name: `${c.name} (${c.code || 'صندوق'})`,
      currencyCode: c.currencyCode,
      type: 'cash' as const,
    })),
    ...bankAccounts.map((b) => ({
      id: b.id,
      name: `${b.accountName || b.bankName} (بنك)`,
      currencyCode: b.currencyCode,
      type: 'bank' as const,
    })),
  ]

  return (
    <SalesInvoiceForm
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      customers={customers.map((c) => ({ ...c, currency: c.currency || 'USD' }))}
      products={products.map((p) => ({ ...p, sku: p.code || '', salePrice: Number(p.salePrice) }))}
      warehouses={warehouses.map((w) => ({ ...w, code: w.code || '' }))}
      treasuryAccounts={treasuryAccounts}
    />
  )
}
