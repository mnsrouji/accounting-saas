import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { BankStatementDetailClient } from './BankStatementDetailClient'

export const metadata: Metadata = {
  title: 'Bank Statement Details | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; statementId: string }>
}

export default async function BankStatementDetailPage({ params }: PageProps) {
  const { businessId, statementId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: {
      bankAccount: true,
      lines: {
        include: {
          matches: true,
        },
        orderBy: { transactionDate: 'asc' },
      },
    },
  })

  if (!statement || statement.businessId !== businessId) {
    notFound()
  }

  // Calculate running balances for display
  let running = Number(statement.openingBalance)
  const linesWithRunning = statement.lines.map((l) => {
    const amt = Number(l.amount)
    running += amt
    return {
      id: l.id,
      date: l.transactionDate.toISOString(),
      valueDate: l.valueDate ? l.valueDate.toISOString() : null,
      description: l.description,
      reference: l.reference,
      amount: Math.abs(amt),
      type: amt < 0 ? 'debit' : 'credit',
      externalTxnId: l.externalId,
      runningBalance: running,
      isMatched: l.matches.length > 0,
      matchedCount: l.matches.length,
    }
  })

  return (
    <BankStatementDetailClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      statement={{
        id: statement.id,
        statementNumber: statement.statementNumber,
        bankAccountId: statement.bankAccountId,
        bankAccountName: statement.bankAccount.accountName,
        bankName: statement.bankAccount.bankName,
        accountNumber: statement.bankAccount.accountNumber || '',
        currency: statement.bankAccount.currencyCode,
        startDate: statement.startDate.toISOString(),
        endDate: statement.endDate.toISOString(),
        openingBalance: Number(statement.openingBalance),
        closingBalance: Number(statement.closingBalance),
        totalDebit: Number(statement.totalDebits),
        totalCredit: Number(statement.totalCredits),
        createdAt: statement.createdAt.toISOString(),
      }}
      lines={linesWithRunning}
    />
  )
}
