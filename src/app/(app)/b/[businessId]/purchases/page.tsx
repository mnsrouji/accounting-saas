import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { PurchasesListClient, PurchaseRow } from './PurchasesListClient'

export const metadata: Metadata = {
  title: 'Purchase Invoices | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function PurchaseInvoicesPage({ params }: PageProps) {
  const { businessId } = await params
  await requireBusinessAccess(businessId)

  const purchases = await prisma.purchase.findMany({
    where: { businessId },
    include: { supplier: true },
    orderBy: { createdAt: 'desc' },
  })

  const tableData: PurchaseRow[] = purchases.map((p) => ({
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    supplierName: p.supplier?.name || 'Supplier',
    purchaseDate: p.purchaseDate.toISOString(),
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    totalAmount: Number(p.totalAmount),
    paidAmount: Number(p.paidAmount),
    balanceDue: Number(p.balanceDue),
    status: p.status,
    currencyCode: p.currencyCode,
  }))

  return (
    <PurchasesListClient
      businessId={businessId}
      purchases={tableData}
    />
  )
}
