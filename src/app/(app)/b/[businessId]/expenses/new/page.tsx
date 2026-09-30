import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { ExpenseForm } from './ExpenseForm'

export const metadata: Metadata = {
  title: 'Record Expense | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NewExpensePage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [expenseAccounts, bankAccounts, cashAccounts] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { businessId, type: 'expense', isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, accountName: true, bankName: true },
      orderBy: { accountName: 'asc' },
    }),
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <ExpenseForm
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      expenseAccounts={expenseAccounts}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName }))}
      cashAccounts={cashAccounts}
    />
  )
}
