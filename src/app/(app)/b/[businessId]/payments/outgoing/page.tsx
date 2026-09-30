import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { PaymentsListClient, type PaymentRow } from '../PaymentsListClient'

export const metadata: Metadata = {
  title: 'Supplier Payments (Outgoing) | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function OutgoingPaymentsPage({ params }: PageProps) {
  const { businessId } = await params
  await requireBusinessAccess(businessId)

  const payments = await prisma.payment.findMany({
    where: { businessId, type: 'outgoing' },
    include: {
      customer: true,
      supplier: true,
      cashAccount: true,
      bankAccount: true,
    },
    orderBy: { paymentDate: 'desc' },
  })

  const tableData: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    type: p.type,
    method: p.method,
    partyName: p.supplier?.name || p.customer?.name || 'General Supplier',
    accountName: p.bankAccount?.accountName || p.cashAccount?.name || 'Cash/Bank',
    paymentDate: p.paymentDate.toISOString(),
    amount: Number(p.amount),
    allocatedAmount: Number(p.allocatedAmount),
    unallocatedAmount: Number(p.unallocatedAmount),
    status: p.status,
    currencyCode: p.currencyCode,
  }))

  return <PaymentsListClient businessId={businessId} payments={tableData} />
}
