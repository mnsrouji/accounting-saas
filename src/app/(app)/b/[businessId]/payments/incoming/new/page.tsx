import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { ProcessCustomerPaymentForm } from './ProcessCustomerPaymentForm'

export const metadata: Metadata = {
  title: 'Receive Customer Payment | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NewCustomerPaymentPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [customers, bankAccounts, cashAccounts, openSales] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, accountName: true, bankName: true, accountNumber: true },
      orderBy: { accountName: 'asc' },
    }),
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: { businessId, status: { in: ['sent', 'partial', 'overdue'] }, balanceDue: { gt: 0 } },
      select: {
        id: true,
        customerId: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        balanceDue: true,
        currencyCode: true,
      },
      orderBy: { invoiceDate: 'asc' },
    }),
  ])

  return (
    <ProcessCustomerPaymentForm
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      customers={customers.map((c) => ({ ...c, currency: c.currency || 'USD' }))}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName, accountNumber: b.accountNumber || '' }))}
      cashAccounts={cashAccounts}
      openSales={openSales.map((s) => ({
        ...s,
        customerId: s.customerId || '',
        invoiceDate: s.invoiceDate.toISOString(),
        totalAmount: Number(s.totalAmount),
        balanceDue: Number(s.balanceDue),
      }))}
    />
  )
}
