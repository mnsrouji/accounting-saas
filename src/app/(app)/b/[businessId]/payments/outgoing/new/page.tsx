import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { ProcessSupplierPaymentForm } from './ProcessSupplierPaymentForm'

export const metadata: Metadata = {
  title: 'Pay Supplier Bill | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NewSupplierPaymentPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [suppliers, bankAccounts, cashAccounts, openPurchases] = await Promise.all([
    prisma.supplier.findMany({
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
    prisma.purchase.findMany({
      where: { businessId, status: { in: ['received', 'partial', 'overdue'] }, balanceDue: { gt: 0 } },
      select: {
        id: true,
        supplierId: true,
        purchaseNumber: true,
        purchaseDate: true,
        totalAmount: true,
        balanceDue: true,
        currencyCode: true,
      },
      orderBy: { purchaseDate: 'asc' },
    }),
  ])

  return (
    <ProcessSupplierPaymentForm
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      suppliers={suppliers.map((s) => ({ ...s, currency: s.currency || 'USD' }))}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName, accountNumber: b.accountNumber || '' }))}
      cashAccounts={cashAccounts}
      openPurchases={openPurchases.map((p) => ({
        ...p,
        supplierId: p.supplierId || '',
        purchaseDate: p.purchaseDate.toISOString(),
        totalAmount: Number(p.totalAmount),
        balanceDue: Number(p.balanceDue),
      }))}
    />
  )
}
