import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { BankReconciliationClient } from './BankReconciliationClient'

export const metadata: Metadata = {
  title: 'Bank Reconciliation | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ bankAccountId?: string; reconciliationId?: string }>
}

export default async function BankReconciliationPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const { bankAccountId, reconciliationId } = await searchParams
  const { business } = await requireBusinessAccess(businessId)

  // Fetch all bank accounts
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { businessId, isActive: true },
    include: { account: true },
    orderBy: { accountName: 'asc' },
  })

  const selectedBankAccountId = bankAccountId || bankAccounts[0]?.id

  let currentReconciliation: any = null
  let statementLines: any[] = []
  let bookTransactions: any[] = []
  let matches: any[] = []
  let adjustments: any[] = []

  if (selectedBankAccountId) {
    if (reconciliationId) {
      currentReconciliation = await prisma.bankReconciliation.findUnique({
        where: { id: reconciliationId },
        include: {
          statement: { include: { lines: true } },
          matches: { include: { statementLine: true, bankTransaction: true } },
          adjustments: { include: { account: true } },
        },
      })
    } else {
      currentReconciliation = await prisma.bankReconciliation.findFirst({
        where: { businessId, bankAccountId: selectedBankAccountId },
        include: {
          statement: { include: { lines: true } },
          matches: { include: { statementLine: true, bankTransaction: true } },
          adjustments: { include: { account: true } },
        },
        orderBy: { periodEnd: 'desc' },
      })
    }

    if (currentReconciliation) {
      matches = currentReconciliation.matches
      adjustments = currentReconciliation.adjustments

      // Fetch statement lines
      if (currentReconciliation.statementId) {
        statementLines = await prisma.bankStatementLine.findMany({
          where: { statementId: currentReconciliation.statementId },
          include: { matches: true },
          orderBy: { transactionDate: 'asc' },
        })
      }

      // Fetch book transactions for the bank account
      bookTransactions = await prisma.bankTransaction.findMany({
        where: { businessId, bankAccountId: selectedBankAccountId },
        orderBy: { transactionDate: 'asc' },
        take: 100,
      })
    }
  }

  const glExpenseIncomeAccounts = await prisma.chartOfAccount.findMany({
    where: { businessId, isActive: true, type: { in: ['expense', 'revenue', 'asset', 'liability'] } },
    orderBy: { code: 'asc' },
  })

  return (
    <BankReconciliationClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      selectedBankAccountId={selectedBankAccountId || ''}
      bankAccounts={bankAccounts.map((b) => ({
        id: b.id,
        name: b.accountName,
        bankName: b.bankName,
        accountNumber: b.accountNumber || '',
        currency: b.currencyCode,
        balance: Number(b.balance),
        glAccountCode: b.account?.code || '',
      }))}
      reconciliation={
        currentReconciliation
          ? {
              id: currentReconciliation.id,
              reconciliationNumber: currentReconciliation.reconciliationNumber,
              statementDate: currentReconciliation.periodEnd.toISOString(),
              statementBalance: Number(currentReconciliation.statementEndingBalance),
              bookBalance: Number(currentReconciliation.bookEndingBalance),
              clearedBalance: Number(currentReconciliation.clearedBalance),
              difference: Number(currentReconciliation.difference),
              status: currentReconciliation.status,
              reconciledAt: currentReconciliation.reconciledAt ? currentReconciliation.reconciledAt.toISOString() : null,
              notes: currentReconciliation.notes,
            }
          : null
      }
      statementLines={statementLines.map((l) => {
        const amt = Number(l.amount)
        return {
          id: l.id,
          date: l.transactionDate.toISOString(),
          valueDate: l.valueDate ? l.valueDate.toISOString() : null,
          description: l.description,
          reference: l.reference,
          amount: Math.abs(amt),
          type: amt < 0 ? 'debit' : 'credit',
          externalTxnId: l.externalId,
          isMatched: l.matches.length > 0,
          matchId: l.matches[0]?.id || null,
        }
      })}
      bookTransactions={bookTransactions.map((t) => {
        const isMatched = matches.some((m) => m.bankTransactionId === t.id)
        const matchItem = matches.find((m) => m.bankTransactionId === t.id)
        return {
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.transactionDate.toISOString(),
          description: t.description,
          reference: t.reference,
          isMatched,
          matchId: matchItem?.id || null,
        }
      })}
      matches={matches.map((m) => ({
        id: m.id,
        matchType: m.matchType,
        statementLineId: m.statementLineId,
        statementLineDesc: m.statementLine?.description || '',
        statementLineAmount: m.statementLine ? Number(m.statementLine.amount) : 0,
        bankTransactionId: m.bankTransactionId || '',
        bankTxnDesc: m.bankTransaction?.description || '',
        bankTxnAmount: m.bankTransaction ? Number(m.bankTransaction.amount) : 0,
        matchedAt: m.matchedAt.toISOString(),
      }))}
      adjustments={adjustments.map((a) => ({
        id: a.id,
        reason: a.adjustmentType,
        amount: Number(a.amount),
        glAccountId: a.accountId,
        glAccountCode: a.account?.code || '',
        glAccountName: a.account?.name || '',
        date: a.adjustmentDate.toISOString(),
        notes: a.reason,
      }))}
      glAccounts={glExpenseIncomeAccounts.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        type: g.type,
      }))}
    />
  )
}
