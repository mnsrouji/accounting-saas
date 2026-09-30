import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { CashAccountDetailClient } from './CashAccountDetailClient'

export const metadata: Metadata = {
  title: 'Cash Account Details | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; accountId: string }>
}

export default async function CashAccountDetailPage({ params }: PageProps) {
  const { businessId, accountId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [account, transactions, transfers, cashCounts, assetGlAccounts] = await Promise.all([
    prisma.cashAccount.findUnique({
      where: { id: accountId },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
        custodian: true,
      },
    }),
    prisma.cashTransaction.findMany({
      where: { businessId, cashAccountId: accountId },
      orderBy: { transactionDate: 'desc' },
      take: 50,
    }),
    prisma.treasuryTransfer.findMany({
      where: {
        businessId,
        OR: [
          { sourceAccountId: accountId, sourceAccountType: 'cash' },
          { destinationAccountId: accountId, destinationAccountType: 'cash' },
        ],
      },
      orderBy: { transferDate: 'desc' },
      take: 20,
    }),
    prisma.pettyCashCount.findMany({
      where: { businessId, cashAccountId: accountId },
      include: { denominations: true },
      orderBy: { countDate: 'desc' },
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
    <CashAccountDetailClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      account={{
        id: account.id,
        name: account.name,
        currency: account.currencyCode,
        balance: liveBalance,
        isPettyCash: account.isPettyCash,
        custodianName: account.custodian?.fullName || null,
        targetFloat: account.targetFloat ? Number(account.targetFloat) : null,
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
      cashCounts={cashCounts.map((cc) => ({
        id: cc.id,
        countNumber: cc.countNumber,
        countDate: cc.countDate.toISOString(),
        systemBalance: Number(cc.systemAmount),
        countedBalance: Number(cc.countedAmount),
        varianceAmount: Number(cc.varianceAmount),
        status: cc.status,
        notes: cc.notes,
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
