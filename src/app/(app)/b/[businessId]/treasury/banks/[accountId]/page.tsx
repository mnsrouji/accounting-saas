import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { BankAccountDetailClient } from './BankAccountDetailClient'

export const metadata: Metadata = {
  title: 'Bank Account Details | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; accountId: string }>
}

export default async function BankAccountDetailPage({ params }: PageProps) {
  const { businessId, accountId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [account, transactions, statements, reconciliations, transfers, assetGlAccounts] = await Promise.all([
    prisma.bankAccount.findUnique({
      where: { id: accountId },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
      },
    }),
    prisma.bankTransaction.findMany({
      where: { businessId, bankAccountId: accountId },
      orderBy: { transactionDate: 'desc' },
      take: 50,
    }),
    prisma.bankStatement.findMany({
      where: { businessId, bankAccountId: accountId },
      include: { lines: true },
      orderBy: { endDate: 'desc' },
      take: 20,
    }),
    prisma.bankReconciliation.findMany({
      where: { businessId, bankAccountId: accountId },
      include: { matches: true, adjustments: true },
      orderBy: { periodEnd: 'desc' },
      take: 20,
    }),
    prisma.treasuryTransfer.findMany({
      where: {
        businessId,
        OR: [
          { sourceAccountId: accountId, sourceAccountType: 'bank' },
          { destinationAccountId: accountId, destinationAccountType: 'bank' },
        ],
      },
      orderBy: { transferDate: 'desc' },
      take: 20,
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: 'asc' },
    }),
  ])

  if (!account || account.businessId !== businessId) {
    notFound()
  }

  const liveBalance = account.account?.journalLines && account.account.journalLines.length > 0
    ? account.account.journalLines.reduce((acc, l) => acc + Number(l.debitAmount) - Number(l.creditAmount), 0)
    : Number(account.balance)

  return (
    <BankAccountDetailClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      account={{
        id: account.id,
        name: account.accountName,
        bankName: account.bankName,
        accountNumber: account.accountNumber || '',
        iban: account.iban,
        swiftCode: account.swift,
        branch: account.branch,
        currency: account.currencyCode,
        balance: liveBalance,
        description: null,
        isActive: account.isActive,
        glAccount: {
          id: account.account?.id || '',
          code: account.account?.code || '—',
          name: account.account?.name || 'Unassigned GL',
        },
        createdAt: account.createdAt.toISOString(),
      }}
      transactions={transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        date: t.transactionDate.toISOString(),
        description: t.description,
        reference: t.reference,
        isPosted: true,
        journalEntryId: t.journalEntryId,
      }))}
      statements={statements.map((st) => ({
        id: st.id,
        statementNumber: st.statementNumber,
        startDate: st.startDate.toISOString(),
        endDate: st.endDate.toISOString(),
        openingBalance: Number(st.openingBalance),
        closingBalance: Number(st.closingBalance),
        totalDebit: Number(st.totalDebits),
        totalCredit: Number(st.totalCredits),
        lineCount: st.lines.length,
      }))}
      reconciliations={reconciliations.map((rc) => ({
        id: rc.id,
        reconciliationNumber: rc.reconciliationNumber,
        statementDate: rc.periodEnd.toISOString(),
        statementBalance: Number(rc.statementEndingBalance),
        bookBalance: Number(rc.bookEndingBalance),
        clearedBalance: Number(rc.clearedBalance),
        difference: Number(rc.difference),
        status: rc.status,
        matchCount: rc.matches.length,
        adjustmentCount: rc.adjustments.length,
      }))}
      transfers={transfers.map((tr) => ({
        id: tr.id,
        transferNumber: tr.transferNumber,
        sourceAccountType: tr.sourceAccountType,
        sourceAccountId: tr.sourceAccountId,
        destinationAccountType: tr.destinationAccountType,
        destinationAccountId: tr.destinationAccountId,
        amount: Number(tr.amount),
        currency: tr.currencyCode,
        status: tr.status,
        transferDate: tr.transferDate.toISOString(),
        reference: tr.reference,
      }))}
      glAccounts={assetGlAccounts.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        type: g.type,
      }))}
    />
  )
}
