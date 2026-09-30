import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { BankStatementsClient } from './BankStatementsClient'

export const metadata: Metadata = {
  title: 'Bank Statements | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function BankStatementsPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [statements, bankAccounts] = await Promise.all([
    prisma.bankStatement.findMany({
      where: { businessId },
      include: {
        bankAccount: true,
        lines: true,
        reconciliations: true,
      },
      orderBy: { endDate: 'desc' },
      take: 100,
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { accountName: 'asc' },
    }),
  ])

  return (
    <BankStatementsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      statements={statements.map((st) => ({
        id: st.id,
        statementNumber: st.statementNumber,
        bankAccountId: st.bankAccountId,
        bankAccountName: st.bankAccount.accountName,
        bankName: st.bankAccount.bankName,
        accountNumber: st.bankAccount.accountNumber || '',
        currency: st.bankAccount.currencyCode,
        startDate: st.startDate.toISOString(),
        endDate: st.endDate.toISOString(),
        openingBalance: Number(st.openingBalance),
        closingBalance: Number(st.closingBalance),
        totalDebit: Number(st.totalDebits),
        totalCredit: Number(st.totalCredits),
        lineCount: st.lines.length,
        isReconciled: st.reconciliations.some((r) => r.status === 'closed'),
        createdAt: st.createdAt.toISOString(),
      }))}
      bankAccounts={bankAccounts.map((b) => ({
        id: b.id,
        name: b.accountName,
        bankName: b.bankName,
        currency: b.currencyCode,
        balance: Number(b.balance),
      }))}
    />
  )
}
