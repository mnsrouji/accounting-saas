import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { ExpensesListClient, type ExpenseRow } from './ExpensesListClient'

export const metadata: Metadata = {
  title: 'Operating Expenses | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function ExpensesPage({ params }: PageProps) {
  const { businessId } = await params
  await requireBusinessAccess(businessId)

  const expenses = await prisma.expense.findMany({
    where: { businessId },
    include: {
      account: true,
      supplier: true,
      cashAccount: true,
      bankAccount: true,
    },
    orderBy: { expenseDate: 'desc' },
  })

  const tableData: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    expenseDate: e.expenseDate.toISOString(),
    description: e.description,
    accountName: e.account?.name ? `${e.account.code} - ${e.account.name}` : 'Expense Account',
    paymentSource: e.bankAccount?.accountName || e.cashAccount?.name || 'Cash/Bank',
    vendor: e.vendor || e.supplier?.name || '—',
    amount: Number(e.amount),
    taxAmount: Number(e.taxAmount),
    status: e.status,
    currencyCode: e.currencyCode,
  }))

  return <ExpensesListClient businessId={businessId} expenses={tableData} />
}

