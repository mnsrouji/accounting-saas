import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { SalesListClient, SaleRow } from './SalesListClient'

export const metadata: Metadata = {
  title: 'Sales & Invoices | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function SalesInvoicesPage({ params }: PageProps) {
  const { businessId } = await params
  await requireBusinessAccess(businessId)

  const sales = await prisma.sale.findMany({
    where: { businessId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  })

  const tableData: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name || 'Walk-in Customer',
    invoiceDate: sale.invoiceDate.toISOString(),
    dueDate: sale.dueDate ? sale.dueDate.toISOString() : null,
    totalAmount: Number(sale.totalAmount),
    paidAmount: Number(sale.paidAmount),
    balanceDue: Number(sale.balanceDue),
    status: sale.status,
    currencyCode: sale.currencyCode,
  }))

  return (
    <SalesListClient
      businessId={businessId}
      sales={tableData}
    />
  )
}
