import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { TreasuryTransactionsClient } from './TreasuryTransactionsClient'

export const metadata: Metadata = {
  title: 'Treasury Transactions | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function TreasuryTransactionsPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [cashTxns, bankTxns, cashAccounts, bankAccounts, glAccounts] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { businessId },
      include: { cashAccount: true },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    }),
    prisma.bankTransaction.findMany({
      where: { businessId },
      include: { bankAccount: true },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    }),
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { accountName: 'asc' },
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: 'asc' },
    }),
  ])

  // Combine cash & bank txns into unified list
  const allTxns = [
    ...cashTxns.map((c) => ({
      id: c.id,
      accountType: 'cash' as const,
      accountId: c.cashAccountId,
      accountName: c.cashAccount.name,
      currency: c.cashAccount.currencyCode,
      type: c.type,
      amount: Number(c.amount),
      date: c.transactionDate.toISOString(),
      description: c.description,
      reference: c.reference,
      isPosted: true,
      journalEntryId: c.journalEntryId,
    })),
    ...bankTxns.map((b) => ({
      id: b.id,
      accountType: 'bank' as const,
      accountId: b.bankAccountId,
      accountName: b.bankAccount.accountName,
      currency: b.bankAccount.currencyCode,
      type: b.type,
      amount: Number(b.amount),
      date: b.transactionDate.toISOString(),
      description: b.description,
      reference: b.reference,
      isPosted: true,
      journalEntryId: b.journalEntryId,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <TreasuryTransactionsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      transactions={allTxns}
      cashAccounts={cashAccounts.map((c) => ({ id: c.id, name: c.name, currency: c.currencyCode, balance: Number(c.balance) }))}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName, currency: b.currencyCode, balance: Number(b.balance) }))}
      glAccounts={glAccounts.map((g) => ({ id: g.id, code: g.code, name: g.name, type: g.type }))}
    />
  )
}
